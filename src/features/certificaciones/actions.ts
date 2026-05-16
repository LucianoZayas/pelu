'use server';

import { revalidatePath } from 'next/cache';
import { and, eq } from 'drizzle-orm';
import { db } from '@/db/client';
import {
  certificacion, avanceItem, presupuesto, itemPresupuesto, obra, conceptoMovimiento,
  movimiento, parte,
} from '@/db/schema';
import { requireRole } from '@/lib/auth/require';
import { logAudit } from '@/features/audit/log';
import { D, toDb } from '@/lib/money/decimal';
import { siguienteNumero, obtenerUltimosAcumuladosDePresupuesto } from './queries';
import {
  crearCertificacionInputSchema, actualizarAvanceInputSchema, emitirInputSchema,
  cobrarInputSchema, anularCertInputSchema,
  type CrearCertificacionInput, type ActualizarAvanceInput, type EmitirInput,
  type CobrarInput, type AnularCertInput,
} from './schema';

type OkResult<T extends object = object> = { ok: true } & T;
type ErrResult = { ok: false; error: string; code?: string };
type Result<T extends object = object> = OkResult<T> | ErrResult;

export async function crearCertificacion(
  input: CrearCertificacionInput,
): Promise<Result<{ id: string; numero: number }>> {
  const admin = await requireRole('admin');
  const parsed = crearCertificacionInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'Datos inválidos' };

  // Validar que el presupuesto exista y esté firmado.
  const [p] = await db
    .select()
    .from(presupuesto)
    .where(eq(presupuesto.id, parsed.data.presupuestoId))
    .limit(1);
  if (!p) return { ok: false, error: 'Presupuesto no encontrado' };
  if (p.estado !== 'firmado') return { ok: false, error: 'Solo se pueden certificar presupuestos firmados' };

  const numero = await siguienteNumero(p.id);

  // Obtener items del presupuesto y los acumulados previos.
  const items = await db
    .select()
    .from(itemPresupuesto)
    .where(eq(itemPresupuesto.presupuestoId, p.id));
  if (items.length === 0) return { ok: false, error: 'El presupuesto no tiene items para certificar' };

  const ultimos = await obtenerUltimosAcumuladosDePresupuesto(p.id);

  const [obraRow] = await db.select().from(obra).where(eq(obra.id, p.obraId));

  const certId = await db.transaction(async (tx) => {
    const [cert] = await tx.insert(certificacion).values({
      presupuestoId: p.id,
      numero,
      moneda: obraRow.monedaBase,
      descripcion: parsed.data.descripcion ?? null,
      estado: 'borrador',
      totalNeto: '0',
      totalHonorarios: '0',
      totalGeneral: '0',
      createdBy: admin.id,
      updatedBy: admin.id,
    }).returning();

    // Inicializar avance_item para cada item del presupuesto con acumulado=0.
    // Se calculan los montos en 0; el admin después actualiza con actualizarAvance.
    if (items.length > 0) {
      await tx.insert(avanceItem).values(items.map((it) => ({
        certificacionId: cert.id,
        itemPresupuestoId: it.id,
        porcentajeAcumulado: String(ultimos.get(it.id) ?? 0),
        porcentajeAnterior: String(ultimos.get(it.id) ?? 0),
        montoNetoFacturado: '0',
        montoHonorariosFacturado: '0',
        porcentajeHonorariosAplicado: String(
          it.porcentajeHonorarios ?? obraRow.porcentajeHonorarios,
        ),
      })));
    }

    return cert.id;
  });

  await logAudit({
    entidad: 'certificacion',
    entidadId: certId,
    accion: 'crear',
    descripcionHumana: `${admin.nombre} creó certificación N° ${numero} del presupuesto #${p.numero}`,
    usuarioId: admin.id,
  });
  revalidatePath(`/obras/${p.obraId}/certificaciones`);
  return { ok: true, id: certId, numero };
}

export async function actualizarAvance(
  input: ActualizarAvanceInput,
): Promise<Result<{ totalNeto: string; totalHonorarios: string; totalGeneral: string; warnings: string[] }>> {
  const admin = await requireRole('admin');
  const parsed = actualizarAvanceInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'Datos inválidos' };

  const [cert] = await db.select().from(certificacion).where(eq(certificacion.id, parsed.data.certificacionId)).limit(1);
  if (!cert) return { ok: false, error: 'Certificación no encontrada' };
  if (cert.estado !== 'borrador') {
    return { ok: false, error: 'Solo se puede editar el avance de certificaciones en borrador' };
  }

  // Cargar items del presupuesto y obra para porcentajes default.
  const [p] = await db.select().from(presupuesto).where(eq(presupuesto.id, cert.presupuestoId));
  const [obraRow] = await db.select().from(obra).where(eq(obra.id, p.obraId));
  const items = await db.select().from(itemPresupuesto).where(eq(itemPresupuesto.presupuestoId, cert.presupuestoId));
  const itemsById = new Map(items.map((it) => [it.id, it]));

  // Acumulados previos (excluyendo esta cert misma — porque queremos solo los DE ANTES).
  const ultimos = await obtenerUltimosAcumuladosDePresupuesto(cert.presupuestoId, cert.id);

  const warnings: string[] = [];
  let totalNeto = D('0');
  let totalHonorarios = D('0');

  type AvanceUpdate = {
    itemPresupuestoId: string;
    porcentajeAcumulado: string;
    porcentajeAnterior: string;
    montoNetoFacturado: string;
    montoHonorariosFacturado: string;
    porcentajeHonorariosAplicado: string;
  };
  const updates: AvanceUpdate[] = [];

  for (const a of parsed.data.avances) {
    const it = itemsById.get(a.itemPresupuestoId);
    if (!it) return { ok: false, error: `Item ${a.itemPresupuestoId} no pertenece al presupuesto` };

    const anterior = ultimos.get(it.id) ?? 0;
    const acumulado = a.porcentajeAcumulado;
    const delta = acumulado - anterior;
    if (delta < 0) {
      warnings.push(`${it.descripcion}: avance retrocede (${anterior}% → ${acumulado}%)`);
    }

    const precioCliente = D(it.precioUnitarioCliente);
    const cantidad = D(it.cantidad);
    const montoNeto = precioCliente.times(cantidad).times(D(delta).div(100));
    const porcentajeHonorarios = D(it.porcentajeHonorarios ?? obraRow.porcentajeHonorarios);
    const montoHonorarios = montoNeto.times(porcentajeHonorarios).div(100);

    updates.push({
      itemPresupuestoId: it.id,
      porcentajeAcumulado: String(acumulado),
      porcentajeAnterior: String(anterior),
      montoNetoFacturado: toDb(montoNeto),
      montoHonorariosFacturado: toDb(montoHonorarios),
      porcentajeHonorariosAplicado: porcentajeHonorarios.toString(),
    });

    totalNeto = totalNeto.plus(montoNeto);
    totalHonorarios = totalHonorarios.plus(montoHonorarios);
  }

  const totalGeneral = totalNeto.plus(totalHonorarios);

  await db.transaction(async (tx) => {
    for (const u of updates) {
      await tx.update(avanceItem).set({
        porcentajeAcumulado: u.porcentajeAcumulado,
        porcentajeAnterior: u.porcentajeAnterior,
        montoNetoFacturado: u.montoNetoFacturado,
        montoHonorariosFacturado: u.montoHonorariosFacturado,
        porcentajeHonorariosAplicado: u.porcentajeHonorariosAplicado,
      }).where(and(
        eq(avanceItem.certificacionId, cert.id),
        eq(avanceItem.itemPresupuestoId, u.itemPresupuestoId),
      ));
    }

    await tx.update(certificacion).set({
      totalNeto: toDb(totalNeto),
      totalHonorarios: toDb(totalHonorarios),
      totalGeneral: toDb(totalGeneral),
      descripcion: parsed.data.descripcion !== undefined ? parsed.data.descripcion : cert.descripcion,
      updatedAt: new Date(),
      updatedBy: admin.id,
    }).where(eq(certificacion.id, cert.id));
  });

  await logAudit({
    entidad: 'certificacion',
    entidadId: cert.id,
    accion: 'editar',
    descripcionHumana: `${admin.nombre} actualizó avance de certificación N° ${cert.numero}`,
    usuarioId: admin.id,
  });
  revalidatePath(`/obras/${p.obraId}/certificaciones`);
  revalidatePath(`/obras/${p.obraId}/certificaciones/${cert.id}`);
  return {
    ok: true,
    totalNeto: toDb(totalNeto),
    totalHonorarios: toDb(totalHonorarios),
    totalGeneral: toDb(totalGeneral),
    warnings,
  };
}

export async function emitirCertificacion(input: EmitirInput): Promise<Result> {
  const admin = await requireRole('admin');
  const parsed = emitirInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Datos inválidos' };

  const [cert] = await db.select().from(certificacion).where(eq(certificacion.id, parsed.data.certificacionId)).limit(1);
  if (!cert) return { ok: false, error: 'No existe' };
  if (cert.estado !== 'borrador') return { ok: false, error: 'Solo borradores pueden emitirse' };
  if (Number(cert.totalGeneral) <= 0) {
    return { ok: false, error: 'La certificación no tiene avance cargado (total = 0)' };
  }

  await db.update(certificacion).set({
    estado: 'emitida',
    fechaEmision: new Date(),
    updatedAt: new Date(),
    updatedBy: admin.id,
  }).where(eq(certificacion.id, cert.id));

  const [p] = await db.select().from(presupuesto).where(eq(presupuesto.id, cert.presupuestoId));
  await logAudit({
    entidad: 'certificacion',
    entidadId: cert.id,
    accion: 'emitir',
    descripcionHumana: `${admin.nombre} emitió certificación N° ${cert.numero}`,
    usuarioId: admin.id,
  });
  revalidatePath(`/obras/${p.obraId}/certificaciones`);
  revalidatePath(`/obras/${p.obraId}/certificaciones/${cert.id}`);
  return { ok: true };
}

export async function marcarCobrada(input: CobrarInput): Promise<Result> {
  const admin = await requireRole('admin');
  const parsed = cobrarInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'Datos inválidos' };

  const [cert] = await db.select().from(certificacion).where(eq(certificacion.id, parsed.data.certificacionId)).limit(1);
  if (!cert) return { ok: false, error: 'No existe' };
  if (cert.estado !== 'emitida') return { ok: false, error: 'Solo certificaciones emitidas pueden marcarse cobradas' };

  const [p] = await db.select().from(presupuesto).where(eq(presupuesto.id, cert.presupuestoId));
  const [obraRow] = await db.select().from(obra).where(eq(obra.id, p.obraId));

  // Resolver conceptos: si vienen explícitos, usarlos; sino buscar por código.
  let conceptoNetoId = parsed.data.conceptoNetoId;
  let conceptoHonorariosId = parsed.data.conceptoHonorariosId;
  if (!conceptoNetoId) {
    const [c] = await db.select().from(conceptoMovimiento).where(eq(conceptoMovimiento.codigo, 'COBRO_CERTIFICACION')).limit(1);
    conceptoNetoId = c?.id;
  }
  if (!conceptoHonorariosId) {
    const [c] = await db.select().from(conceptoMovimiento).where(eq(conceptoMovimiento.codigo, 'HO')).limit(1);
    conceptoHonorariosId = c?.id;
  }
  if (!conceptoNetoId) {
    return { ok: false, error: 'Falta concepto "COBRO_CERTIFICACION" en /configuracion/conceptos (o pasalo explícito)' };
  }
  if (!conceptoHonorariosId) {
    return { ok: false, error: 'Falta concepto "HO" en /configuracion/conceptos' };
  }

  // Resolver parte cliente de la obra (puede ser null si por alguna razón no se creó).
  const [parteCliente] = await db.select().from(parte)
    .where(and(eq(parte.obraId, p.obraId), eq(parte.tipo, 'cliente')))
    .limit(1);

  const fechaMov = new Date(parsed.data.fecha);

  await db.transaction(async (tx) => {
    // Mov 1: neto (cobro de cliente)
    if (Number(cert.totalNeto) > 0) {
      await tx.insert(movimiento).values({
        tipo: 'entrada',
        fecha: fechaMov,
        conceptoId: conceptoNetoId,
        monto: cert.totalNeto,
        moneda: cert.moneda,
        cuentaId: parsed.data.cuentaId,
        obraId: p.obraId,
        parteOrigenId: parteCliente?.id ?? null,
        descripcion: `Cobro neto certificación N° ${cert.numero} (presupuesto #${p.numero})`,
        estado: 'confirmado',
        certificacionId: cert.id,
        createdBy: admin.id,
        updatedBy: admin.id,
      });
    }

    // Mov 2: honorarios
    if (Number(cert.totalHonorarios) > 0) {
      await tx.insert(movimiento).values({
        tipo: 'entrada',
        fecha: fechaMov,
        conceptoId: conceptoHonorariosId,
        monto: cert.totalHonorarios,
        moneda: cert.moneda,
        cuentaId: parsed.data.cuentaId,
        obraId: p.obraId,
        parteOrigenId: parteCliente?.id ?? null,
        descripcion: `Honorarios certificación N° ${cert.numero} (${cert.totalHonorarios} sobre ${cert.totalNeto})`,
        estado: 'confirmado',
        certificacionId: cert.id,
        createdBy: admin.id,
        updatedBy: admin.id,
      });
    }

    await tx.update(certificacion).set({
      estado: 'cobrada',
      fechaCobro: fechaMov,
      updatedAt: new Date(),
      updatedBy: admin.id,
    }).where(eq(certificacion.id, cert.id));
  });

  await logAudit({
    entidad: 'certificacion',
    entidadId: cert.id,
    accion: 'cobrar',
    descripcionHumana: `${admin.nombre} marcó cobrada cert N° ${cert.numero}: ${cert.totalNeto} neto + ${cert.totalHonorarios} honorarios = ${cert.totalGeneral} ${cert.moneda}`,
    usuarioId: admin.id,
  });
  revalidatePath(`/obras/${p.obraId}/certificaciones`);
  revalidatePath(`/obras/${p.obraId}/certificaciones/${cert.id}`);
  revalidatePath('/movimientos');
  revalidatePath('/flujo');
  return { ok: true };
}

export async function anularCertificacion(input: AnularCertInput): Promise<Result> {
  const admin = await requireRole('admin');
  const parsed = anularCertInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'Datos inválidos' };

  const [cert] = await db.select().from(certificacion).where(eq(certificacion.id, parsed.data.certificacionId)).limit(1);
  if (!cert) return { ok: false, error: 'No existe' };
  if (cert.estado === 'anulada') return { ok: false, error: 'Ya está anulada' };

  await db.transaction(async (tx) => {
    // Si estaba cobrada, anular también los movimientos linkeados.
    if (cert.estado === 'cobrada') {
      await tx.update(movimiento).set({
        estado: 'anulado',
        anuladoMotivo: `Anulación de certificación N° ${cert.numero}: ${parsed.data.motivo}`,
        anuladoAt: new Date(),
        anuladoBy: admin.id,
      }).where(and(
        eq(movimiento.certificacionId, cert.id),
        eq(movimiento.estado, 'confirmado'),
      ));
    }

    await tx.update(certificacion).set({
      estado: 'anulada',
      anuladoMotivo: parsed.data.motivo,
      anuladoAt: new Date(),
      anuladoBy: admin.id,
      updatedAt: new Date(),
      updatedBy: admin.id,
    }).where(eq(certificacion.id, cert.id));
  });

  const [p] = await db.select().from(presupuesto).where(eq(presupuesto.id, cert.presupuestoId));
  await logAudit({
    entidad: 'certificacion',
    entidadId: cert.id,
    accion: 'anular',
    descripcionHumana: `${admin.nombre} anuló certificación N° ${cert.numero}. Motivo: ${parsed.data.motivo}`,
    usuarioId: admin.id,
  });
  revalidatePath(`/obras/${p.obraId}/certificaciones`);
  revalidatePath(`/obras/${p.obraId}/certificaciones/${cert.id}`);
  revalidatePath('/movimientos');
  revalidatePath('/flujo');
  return { ok: true };
}
