'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { eq, inArray } from 'drizzle-orm';
import { db } from '@/db/client';
import { itemPresupuesto, presupuesto } from '@/db/schema';
import { requireRole } from '@/lib/auth/require';
import { logAudit } from '@/features/audit/log';

const actualizarItemSchema = z.object({
  itemId: z.string().uuid(),
  porcentaje: z.coerce.number().min(0).max(100),
});

type Result = { ok: true } | { ok: false; error: string };

// Actualiza el % avance de UN item. Llamada típica: slider on-change con debounce.
export async function actualizarAvanceItem(input: { itemId: string; porcentaje: number }): Promise<Result> {
  const admin = await requireRole('admin');
  const parsed = actualizarItemSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'Datos inválidos' };

  const [item] = await db.select().from(itemPresupuesto).where(eq(itemPresupuesto.id, parsed.data.itemId)).limit(1);
  if (!item) return { ok: false, error: 'Item no encontrado' };

  // Necesitamos saber el presupuesto para revalidar paths.
  const [p] = await db.select().from(presupuesto).where(eq(presupuesto.id, item.presupuestoId)).limit(1);
  if (!p) return { ok: false, error: 'Presupuesto no encontrado' };

  await db.update(itemPresupuesto)
    .set({ porcentajeAvance: String(parsed.data.porcentaje) })
    .where(eq(itemPresupuesto.id, parsed.data.itemId));

  await logAudit({
    entidad: 'item_presupuesto',
    entidadId: parsed.data.itemId,
    accion: 'editar',
    descripcionHumana: `${admin.nombre} actualizó avance del item a ${parsed.data.porcentaje}%`,
    usuarioId: admin.id,
  });

  revalidatePath(`/obras/${p.obraId}/avance`);
  revalidatePath(`/cliente/[token]/${p.id}`, 'page');
  return { ok: true };
}

// Update batch: para actualizar varios items en una sola tx (útil al cargar
// avances masivos o al inicializar).
const actualizarBatchSchema = z.object({
  obraId: z.string().uuid(),
  items: z.array(actualizarItemSchema).min(1),
});

export async function actualizarAvanceBatch(input: { obraId: string; items: { itemId: string; porcentaje: number }[] }): Promise<Result> {
  const admin = await requireRole('admin');
  const parsed = actualizarBatchSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Datos inválidos' };

  await db.transaction(async (tx) => {
    for (const { itemId, porcentaje } of parsed.data.items) {
      await tx.update(itemPresupuesto)
        .set({ porcentajeAvance: String(porcentaje) })
        .where(eq(itemPresupuesto.id, itemId));
    }
  });

  const ids = parsed.data.items.map((i) => i.itemId);
  await logAudit({
    entidad: 'item_presupuesto',
    entidadId: ids[0],
    accion: 'editar',
    descripcionHumana: `${admin.nombre} actualizó avance de ${ids.length} items`,
    usuarioId: admin.id,
  });

  revalidatePath(`/obras/${parsed.data.obraId}/avance`);
  return { ok: true };
}
