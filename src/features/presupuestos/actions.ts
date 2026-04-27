'use server';

import { revalidatePath } from 'next/cache';
import { eq, and, isNull } from 'drizzle-orm';
import { db } from '@/db/client';
import { presupuesto, itemPresupuesto } from '@/db/schema';
import { requireRole } from '@/lib/auth/require';
import { logAudit } from '@/features/audit/log';
import { D, toDb } from '@/lib/money/decimal';
import { calcularSnapshotItem, type PresupuestoCtx } from './services/snapshots';
import { calcularTotales } from './totales';
import {
  nuevoPresupuestoSchema, guardarPresupuestoSchema,
  type NuevoPresupuestoInput, type GuardarPresupuestoInput,
} from './schema';
import { getMaxNumero, getPresupuesto, getItemsConRubros } from './queries';
import { StaleVersionError } from './errors';

type OkResult<T extends object = object> = { ok: true } & T;
type ErrResult = { ok: false; error: string; code?: string };
type Result<T extends object = object> = OkResult<T> | ErrResult;

export async function crearPresupuesto(input: NuevoPresupuestoInput): Promise<Result<{ id: string }>> {
  const admin = await requireRole('admin');
  const parsed = nuevoPresupuestoSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Datos inválidos' };

  const tieneOriginal = (await db.select({ id: presupuesto.id }).from(presupuesto)
    .where(and(eq(presupuesto.obraId, parsed.data.obraId), eq(presupuesto.tipo, 'original'), isNull(presupuesto.deletedAt)))
    .limit(1)).length > 0;
  if (parsed.data.tipo === 'original' && tieneOriginal) {
    return { ok: false, error: 'La obra ya tiene presupuesto original' };
  }
  if (parsed.data.tipo === 'adicional' && !tieneOriginal) {
    return { ok: false, error: 'No se puede crear adicional sin original previo' };
  }

  const numero = (await getMaxNumero(parsed.data.obraId)) + 1;

  const [p] = await db.insert(presupuesto).values({
    obraId: parsed.data.obraId, tipo: parsed.data.tipo, numero,
    descripcion: parsed.data.descripcion ?? null,
    markupDefaultPorcentaje: parsed.data.markupDefaultPorcentaje,
    cotizacionUsd: parsed.data.cotizacionUsd,
    estado: 'borrador', version: 1,
    createdBy: admin.id, updatedBy: admin.id,
  }).returning();

  await logAudit({
    entidad: 'presupuesto', entidadId: p.id, accion: 'crear',
    after: p as Record<string, unknown>, usuarioId: admin.id,
    descripcionHumana: `${admin.nombre} creó presupuesto #${numero} (${parsed.data.tipo})`,
  });

  revalidatePath(`/obras/${parsed.data.obraId}`);
  return { ok: true, id: p.id };
}

export async function guardarPresupuesto(input: GuardarPresupuestoInput): Promise<Result> {
  const admin = await requireRole('admin');
  const parsed = guardarPresupuestoSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Datos inválidos' };

  const p = await getPresupuesto(parsed.data.presupuestoId);
  if (!p) return { ok: false, error: 'Presupuesto no encontrado' };
  if (p.estado === 'firmado') return { ok: false, error: 'Presupuesto firmado, no editable', code: 'IMMUTABLE' };

  const ctx: PresupuestoCtx = {
    monedaBase: p.obra.monedaBase,
    cotizacionUsd: D(parsed.data.cotizacionUsd),
    markupDefault: D(parsed.data.markupDefaultPorcentaje),
  };

  // Calcular snapshots
  const itemsConSnapshots = parsed.data.items.map((it) => {
    const snap = calcularSnapshotItem({
      cantidad: D(it.cantidad),
      costoUnitario: D(it.costoUnitario),
      costoUnitarioMoneda: it.costoUnitarioMoneda,
      markupPorcentaje: it.markupPorcentaje ? D(it.markupPorcentaje) : null,
    }, ctx);
    return { input: it, snap };
  });

  // Concurrencia optimista + transacción
  const newVersion = parsed.data.version + 1;

  try {
    await db.transaction(async (tx) => {
      // UPDATE presupuesto WHERE version = ?
      const updated = await tx.update(presupuesto).set({
        descripcion: parsed.data.descripcion,
        markupDefaultPorcentaje: parsed.data.markupDefaultPorcentaje,
        cotizacionUsd: parsed.data.cotizacionUsd,
        version: newVersion,
        updatedAt: new Date(), updatedBy: admin.id,
      }).where(and(
        eq(presupuesto.id, parsed.data.presupuestoId),
        eq(presupuesto.version, parsed.data.version),
        isNull(presupuesto.deletedAt),
      )).returning({ id: presupuesto.id });

      if (updated.length === 0) {
        throw new StaleVersionError(parsed.data.version);
      }

      // Strategy: borrar todos los items existentes y reinsertar.
      // Razón: simplifica diff con UI, edge cases mínimos (presupuestos típicos < 500 items).
      await tx.delete(itemPresupuesto).where(eq(itemPresupuesto.presupuestoId, parsed.data.presupuestoId));

      if (itemsConSnapshots.length > 0) {
        await tx.insert(itemPresupuesto).values(itemsConSnapshots.map(({ input: it, snap }) => ({
          presupuestoId: parsed.data.presupuestoId,
          rubroId: it.rubroId, orden: it.orden, descripcion: it.descripcion,
          unidad: it.unidad, cantidad: it.cantidad,
          costoUnitario: it.costoUnitario, costoUnitarioMoneda: it.costoUnitarioMoneda,
          costoUnitarioBase: toDb(snap.costoUnitarioBase),
          markupPorcentaje: it.markupPorcentaje,
          markupEfectivoPorcentaje: toDb(snap.markupEfectivoPorcentaje, 2),
          precioUnitarioCliente: toDb(snap.precioUnitarioCliente),
          notas: it.notas,
        })));
      }
    });
  } catch (e) {
    if (e instanceof StaleVersionError) return { ok: false, error: e.message, code: 'STALE_VERSION' };
    throw e;
  }

  await logAudit({
    entidad: 'presupuesto', entidadId: parsed.data.presupuestoId, accion: 'editar',
    usuarioId: admin.id,
  });
  revalidatePath(`/obras/${p.obraId}/presupuestos/${p.id}`);
  return { ok: true };
}

export async function firmarPresupuesto(presupuestoId: string, version: number): Promise<Result> {
  const admin = await requireRole('admin');
  const p = await getPresupuesto(presupuestoId);
  if (!p) return { ok: false, error: 'No existe' };
  if (p.estado === 'firmado') return { ok: false, error: 'Ya estaba firmado' };
  if (p.estado === 'cancelado') return { ok: false, error: 'Está cancelado' };

  // Calcular totales para snapshot.
  const items = await getItemsConRubros(presupuestoId);
  const tot = calcularTotales(items.map(({ item }) => ({
    rubroId: item.rubroId,
    subtotalCosto: D(item.costoUnitarioBase).times(item.cantidad),
    subtotalCliente: D(item.precioUnitarioCliente).times(item.cantidad),
  })));

  const updated = await db.update(presupuesto).set({
    estado: 'firmado', fechaFirma: new Date(),
    totalCostoCalculado: toDb(tot.totalCosto),
    totalClienteCalculado: toDb(tot.totalCliente),
    version: version + 1,
    updatedAt: new Date(), updatedBy: admin.id,
  }).where(and(
    eq(presupuesto.id, presupuestoId),
    eq(presupuesto.version, version),
    eq(presupuesto.estado, 'borrador'),
  )).returning();

  if (updated.length === 0) {
    return { ok: false, error: 'Versión obsoleta o estado cambió. Recargá.', code: 'STALE_VERSION' };
  }

  await logAudit({
    entidad: 'presupuesto', entidadId: presupuestoId, accion: 'firmar',
    after: updated[0] as Record<string, unknown>, usuarioId: admin.id,
    descripcionHumana: `${admin.nombre} firmó el Presupuesto #${p.numero} de ${p.obra.codigo}`,
  });

  revalidatePath(`/obras/${p.obraId}`);
  return { ok: true };
}

export async function cancelarPresupuesto(presupuestoId: string, version: number): Promise<Result> {
  const admin = await requireRole('admin');
  const p = await getPresupuesto(presupuestoId);
  if (!p) return { ok: false, error: 'No existe' };
  if (p.estado === 'cancelado') return { ok: false, error: 'Ya cancelado' };

  // Cancelar bypassa el trigger (sólo bloquea estado=firmado→firmado, NO firmado→cancelado).
  const updated = await db.update(presupuesto).set({
    estado: 'cancelado', version: version + 1, updatedAt: new Date(), updatedBy: admin.id,
  }).where(and(eq(presupuesto.id, presupuestoId), eq(presupuesto.version, version))).returning();

  if (updated.length === 0) {
    return { ok: false, error: 'Versión obsoleta', code: 'STALE_VERSION' };
  }

  await logAudit({
    entidad: 'presupuesto', entidadId: presupuestoId, accion: 'cancelar',
    after: updated[0] as Record<string, unknown>, usuarioId: admin.id,
    descripcionHumana: `${admin.nombre} canceló el Presupuesto #${p.numero}`,
  });

  revalidatePath(`/obras/${p.obraId}`);
  return { ok: true };
}
