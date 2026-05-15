'use server';

import { revalidatePath } from 'next/cache';
import { eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { movimiento, conceptoMovimiento, cuenta as cuentaTable } from '@/db/schema';
import { requireRole, requireSession } from '@/lib/auth/require';
import { logAudit } from '@/features/audit/log';
import {
  movimientoInputSchema,
  anularInputSchema,
  type MovimientoInput,
  type AnularInput,
} from './schema';

type Result<T extends object = object> = ({ ok: true } & T) | { ok: false; error: string };

async function loadConcepto(conceptoId: string) {
  const [c] = await db.select().from(conceptoMovimiento).where(eq(conceptoMovimiento.id, conceptoId));
  return c ?? null;
}

async function loadCuenta(cuentaId: string) {
  const [c] = await db.select().from(cuentaTable).where(eq(cuentaTable.id, cuentaId));
  return c ?? null;
}

function validarReglas(
  input: MovimientoInput,
  concepto: typeof conceptoMovimiento.$inferSelect,
): string | null {
  if (concepto.tipo === 'transferencia' && input.tipoOperacion !== 'transferencia') {
    return 'El concepto seleccionado es de transferencia: el formulario no coincide';
  }
  if (concepto.tipo !== 'transferencia' && input.tipoOperacion === 'transferencia') {
    return 'El concepto no es de transferencia';
  }
  if (concepto.tipo === 'ingreso' && input.tipoOperacion !== 'entrada') {
    return 'El concepto es de ingreso pero se intentó cargar como salida';
  }
  if (concepto.tipo === 'egreso' && input.tipoOperacion !== 'salida') {
    return 'El concepto es de egreso pero se intentó cargar como entrada';
  }
  if (concepto.requiereObra && !('obraId' in input ? input.obraId : null)) {
    return `El concepto "${concepto.nombre}" requiere una obra asignada`;
  }
  if (concepto.requiereProveedor && !('proveedorId' in input ? input.proveedorId : null)) {
    return `El concepto "${concepto.nombre}" requiere un proveedor asignado`;
  }
  return null;
}

export async function crearMovimiento(input: MovimientoInput): Promise<Result<{ id: string }>> {
  const user = await requireSession();
  if (user.rol !== 'admin' && user.rol !== 'operador') {
    return { ok: false, error: 'No autorizado' };
  }

  const parsed = movimientoInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'Datos inválidos' };

  const concepto = await loadConcepto(parsed.data.conceptoId);
  if (!concepto) return { ok: false, error: 'Concepto no encontrado' };
  if (!concepto.activo) return { ok: false, error: 'Concepto archivado' };

  const reglas = validarReglas(parsed.data, concepto);
  if (reglas) return { ok: false, error: reglas };

  const fecha = new Date(parsed.data.fecha);

  if (parsed.data.tipoOperacion === 'transferencia') {
    const cuentaOrigen = await loadCuenta(parsed.data.cuentaId);
    const cuentaDestinoRow = await loadCuenta(parsed.data.cuentaDestinoId);
    if (!cuentaOrigen || !cuentaDestinoRow) return { ok: false, error: 'Cuenta inválida' };

    const requiereMontoDestino = cuentaOrigen.moneda !== cuentaDestinoRow.moneda;
    if (requiereMontoDestino && (!parsed.data.montoDestino || !parsed.data.cotizacionUsd)) {
      return { ok: false, error: 'Cambio de moneda: monto destino y cotización requeridos' };
    }
    const montoDestino = requiereMontoDestino
      ? Number(parsed.data.montoDestino)
      : Number(parsed.data.monto);

    const [m] = await db.insert(movimiento).values({
      tipo: 'transferencia',
      fecha,
      conceptoId: parsed.data.conceptoId,
      monto: String(parsed.data.monto),
      moneda: cuentaOrigen.moneda,
      montoDestino: String(montoDestino),
      cotizacionUsd: parsed.data.cotizacionUsd ? String(parsed.data.cotizacionUsd) : null,
      cuentaId: parsed.data.cuentaId,
      cuentaDestinoId: parsed.data.cuentaDestinoId,
      descripcion: parsed.data.descripcion ?? null,
      numeroComprobante: parsed.data.numeroComprobante ?? null,
      comprobanteUrl: parsed.data.comprobanteUrl ?? null,
      esNoRecuperable: parsed.data.esNoRecuperable,
      estado: 'confirmado',
      createdBy: user.id,
      updatedBy: user.id,
    }).returning();

    await logAudit({
      entidad: 'movimiento', entidadId: m.id, accion: 'crear',
      after: m as unknown as Record<string, unknown>, usuarioId: user.id,
      descripcionHumana: `Transferencia ${cuentaOrigen.nombre} → ${cuentaDestinoRow.nombre}`,
    });
    revalidatePath('/movimientos');
    revalidatePath('/configuracion/cuentas');
    if (parsed.data.tipoOperacion === 'transferencia') revalidatePath('/flujo/empresa');
    return { ok: true, id: m.id };
  }

  // entrada / salida
  const tipo = parsed.data.tipoOperacion;
  const cuentaRow = await loadCuenta(parsed.data.cuentaId);
  if (!cuentaRow) return { ok: false, error: 'Cuenta inválida' };

  const [m] = await db.insert(movimiento).values({
    tipo,
    fecha,
    conceptoId: parsed.data.conceptoId,
    monto: String(parsed.data.monto),
    moneda: parsed.data.moneda,
    cotizacionUsd: parsed.data.cotizacionUsd ? String(parsed.data.cotizacionUsd) : null,
    cuentaId: parsed.data.cuentaId,
    obraId: parsed.data.obraId ?? null,
    rubroId: parsed.data.rubroId ?? null,
    proveedorId: parsed.data.proveedorId ?? null,
    parteOrigenId: parsed.data.parteOrigenId ?? null,
    parteDestinoId: parsed.data.parteDestinoId ?? null,
    descripcion: parsed.data.descripcion ?? null,
    numeroComprobante: parsed.data.numeroComprobante ?? null,
    comprobanteUrl: parsed.data.comprobanteUrl ?? null,
    esNoRecuperable: parsed.data.esNoRecuperable || concepto.esNoRecuperable,
    estado: 'confirmado',
    createdBy: user.id,
    updatedBy: user.id,
  }).returning();

  await logAudit({
    entidad: 'movimiento', entidadId: m.id, accion: 'crear',
    after: m as unknown as Record<string, unknown>, usuarioId: user.id,
    descripcionHumana: `${tipo === 'entrada' ? 'Ingreso' : 'Egreso'} ${concepto.nombre} ${parsed.data.monto} ${parsed.data.moneda}`,
  });
  revalidatePath('/movimientos');
  revalidatePath('/configuracion/cuentas');
  if (parsed.data.obraId) revalidatePath(`/obras/${parsed.data.obraId}/flujo`);
  return { ok: true, id: m.id };
}

export async function editarMovimiento(
  id: string,
  input: MovimientoInput,
  expectedVersion: number,
): Promise<Result> {
  const user = await requireSession();
  const [before] = await db.select().from(movimiento).where(eq(movimiento.id, id));
  if (!before) return { ok: false, error: 'No existe' };
  if (before.estado === 'anulado') return { ok: false, error: 'No se puede editar un movimiento anulado. Restaurálo primero.' };

  // Operador solo puede editar lo propio.
  if (user.rol !== 'admin' && before.createdBy !== user.id) {
    return { ok: false, error: 'Solo podés editar movimientos que cargaste vos' };
  }

  if (before.version !== expectedVersion) {
    return { ok: false, error: 'STALE_VERSION: alguien más modificó este movimiento. Recargá la página.' };
  }

  const parsed = movimientoInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'Datos inválidos' };

  const concepto = await loadConcepto(parsed.data.conceptoId);
  if (!concepto) return { ok: false, error: 'Concepto no encontrado' };
  const reglas = validarReglas(parsed.data, concepto);
  if (reglas) return { ok: false, error: reglas };

  const fecha = new Date(parsed.data.fecha);
  const data = parsed.data;

  let newValues;
  if (data.tipoOperacion === 'transferencia') {
    const cuentaRow = await loadCuenta(data.cuentaId);
    newValues = {
      tipo: 'transferencia' as const,
      fecha,
      conceptoId: data.conceptoId,
      monto: String(data.monto),
      moneda: cuentaRow?.moneda ?? before.moneda,
      montoDestino: data.montoDestino ? String(data.montoDestino) : String(data.monto),
      cotizacionUsd: data.cotizacionUsd ? String(data.cotizacionUsd) : null,
      cuentaId: data.cuentaId,
      cuentaDestinoId: data.cuentaDestinoId,
      obraId: null,
      rubroId: null,
      proveedorId: null,
      parteOrigenId: null,
      parteDestinoId: null,
      descripcion: data.descripcion ?? null,
      numeroComprobante: data.numeroComprobante ?? null,
      comprobanteUrl: data.comprobanteUrl ?? null,
      esNoRecuperable: data.esNoRecuperable,
      version: before.version + 1,
      updatedBy: user.id,
      updatedAt: new Date(),
    };
  } else {
    newValues = {
      tipo: data.tipoOperacion,
      fecha,
      conceptoId: data.conceptoId,
      monto: String(data.monto),
      moneda: data.moneda,
      cotizacionUsd: data.cotizacionUsd ? String(data.cotizacionUsd) : null,
      cuentaId: data.cuentaId,
      cuentaDestinoId: null,
      montoDestino: null,
      obraId: data.obraId ?? null,
      rubroId: data.rubroId ?? null,
      proveedorId: data.proveedorId ?? null,
      parteOrigenId: data.parteOrigenId ?? null,
      parteDestinoId: data.parteDestinoId ?? null,
      descripcion: data.descripcion ?? null,
      numeroComprobante: data.numeroComprobante ?? null,
      comprobanteUrl: data.comprobanteUrl ?? null,
      esNoRecuperable: data.esNoRecuperable || concepto.esNoRecuperable,
      version: before.version + 1,
      updatedBy: user.id,
      updatedAt: new Date(),
    };
  }

  const [after] = await db.update(movimiento).set(newValues).where(eq(movimiento.id, id)).returning();
  await logAudit({
    entidad: 'movimiento', entidadId: id, accion: 'editar',
    before: before as unknown as Record<string, unknown>,
    after: after as unknown as Record<string, unknown>,
    usuarioId: user.id,
  });
  revalidatePath('/movimientos');
  revalidatePath(`/movimientos/${id}`);
  revalidatePath('/configuracion/cuentas');
  if (after.obraId) revalidatePath(`/obras/${after.obraId}/flujo`);
  return { ok: true };
}

export async function anularMovimiento(id: string, input: AnularInput): Promise<Result> {
  const admin = await requireRole('admin');
  const parsed = anularInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'Datos inválidos' };

  const [before] = await db.select().from(movimiento).where(eq(movimiento.id, id));
  if (!before) return { ok: false, error: 'No existe' };
  if (before.estado === 'anulado') return { ok: false, error: 'Ya está anulado' };

  const [after] = await db.update(movimiento).set({
    estado: 'anulado',
    anuladoMotivo: parsed.data.motivo,
    anuladoAt: new Date(),
    anuladoBy: admin.id,
    version: before.version + 1,
    updatedBy: admin.id,
    updatedAt: new Date(),
  }).where(eq(movimiento.id, id)).returning();

  await logAudit({
    entidad: 'movimiento', entidadId: id, accion: 'anular',
    before: before as unknown as Record<string, unknown>,
    after: after as unknown as Record<string, unknown>,
    usuarioId: admin.id,
    descripcionHumana: parsed.data.motivo,
  });
  revalidatePath('/movimientos');
  revalidatePath(`/movimientos/${id}`);
  revalidatePath('/configuracion/cuentas');
  if (after.obraId) revalidatePath(`/obras/${after.obraId}/flujo`);
  return { ok: true };
}

export async function restaurarMovimiento(id: string): Promise<Result> {
  const admin = await requireRole('admin');
  const [before] = await db.select().from(movimiento).where(eq(movimiento.id, id));
  if (!before) return { ok: false, error: 'No existe' };
  if (before.estado !== 'anulado') return { ok: false, error: 'No está anulado' };

  const [after] = await db.update(movimiento).set({
    estado: 'confirmado',
    anuladoMotivo: null,
    anuladoAt: null,
    anuladoBy: null,
    version: before.version + 1,
    updatedBy: admin.id,
    updatedAt: new Date(),
  }).where(eq(movimiento.id, id)).returning();

  await logAudit({
    entidad: 'movimiento', entidadId: id, accion: 'restaurar',
    before: before as unknown as Record<string, unknown>,
    after: after as unknown as Record<string, unknown>,
    usuarioId: admin.id,
  });
  revalidatePath('/movimientos');
  revalidatePath(`/movimientos/${id}`);
  revalidatePath('/configuracion/cuentas');
  if (after.obraId) revalidatePath(`/obras/${after.obraId}/flujo`);
  return { ok: true };
}
