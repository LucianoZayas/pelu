'use server';

import { revalidatePath } from 'next/cache';
import { eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { conceptoMovimiento } from '@/db/schema';
import { requireRole } from '@/lib/auth/require';
import { logAudit } from '@/features/audit/log';
import { conceptoMovimientoInputSchema, type ConceptoMovimientoInput } from './schema';

type Result<T extends object = object> = ({ ok: true } & T) | { ok: false; error: string };

export async function crearConcepto(input: ConceptoMovimientoInput): Promise<Result<{ id: string }>> {
  const admin = await requireRole('admin');
  const parsed = conceptoMovimientoInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Datos inválidos' };
  }

  const existing = await db.select().from(conceptoMovimiento)
    .where(eq(conceptoMovimiento.codigo, parsed.data.codigo)).limit(1);
  if (existing.length > 0) return { ok: false, error: `Ya existe un concepto con código ${parsed.data.codigo}` };

  const [c] = await db.insert(conceptoMovimiento).values(parsed.data).returning();
  await logAudit({
    entidad: 'concepto_movimiento', entidadId: c.id, accion: 'crear',
    after: c as unknown as Record<string, unknown>, usuarioId: admin.id,
  });
  revalidatePath('/configuracion/conceptos');
  return { ok: true, id: c.id };
}

export async function editarConcepto(id: string, input: Partial<ConceptoMovimientoInput>): Promise<Result> {
  const admin = await requireRole('admin');
  const [before] = await db.select().from(conceptoMovimiento).where(eq(conceptoMovimiento.id, id));
  if (!before) return { ok: false, error: 'No existe' };

  const merged = {
    codigo: input.codigo ?? before.codigo,
    nombre: input.nombre ?? before.nombre,
    tipo: (input.tipo ?? before.tipo) as 'ingreso' | 'egreso' | 'transferencia',
    requiereObra: input.requiereObra !== undefined ? input.requiereObra : before.requiereObra,
    requiereProveedor: input.requiereProveedor !== undefined ? input.requiereProveedor : before.requiereProveedor,
    esNoRecuperable: input.esNoRecuperable !== undefined ? input.esNoRecuperable : before.esNoRecuperable,
    orden: input.orden !== undefined ? input.orden : before.orden,
    activo: input.activo !== undefined ? input.activo : before.activo,
  };
  const parsed = conceptoMovimientoInputSchema.safeParse(merged);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Datos inválidos' };
  }

  if (parsed.data.codigo !== before.codigo) {
    const dup = await db.select().from(conceptoMovimiento)
      .where(eq(conceptoMovimiento.codigo, parsed.data.codigo)).limit(1);
    if (dup.length > 0) return { ok: false, error: `Ya existe un concepto con código ${parsed.data.codigo}` };
  }

  const [after] = await db.update(conceptoMovimiento).set(parsed.data).where(eq(conceptoMovimiento.id, id)).returning();
  await logAudit({
    entidad: 'concepto_movimiento', entidadId: id, accion: 'editar',
    before: before as unknown as Record<string, unknown>,
    after: after as unknown as Record<string, unknown>,
    usuarioId: admin.id,
  });
  revalidatePath('/configuracion/conceptos');
  return { ok: true };
}

export async function archivarConcepto(id: string): Promise<Result> {
  const admin = await requireRole('admin');
  const [before] = await db.select().from(conceptoMovimiento).where(eq(conceptoMovimiento.id, id));
  if (!before) return { ok: false, error: 'No existe' };
  await db.update(conceptoMovimiento).set({ activo: false }).where(eq(conceptoMovimiento.id, id));
  await logAudit({
    entidad: 'concepto_movimiento', entidadId: id, accion: 'eliminar',
    before: before as unknown as Record<string, unknown>,
    usuarioId: admin.id,
  });
  revalidatePath('/configuracion/conceptos');
  return { ok: true };
}

export async function restaurarConcepto(id: string): Promise<Result> {
  const admin = await requireRole('admin');
  const [before] = await db.select().from(conceptoMovimiento).where(eq(conceptoMovimiento.id, id));
  if (!before) return { ok: false, error: 'No existe' };
  await db.update(conceptoMovimiento).set({ activo: true }).where(eq(conceptoMovimiento.id, id));
  await logAudit({
    entidad: 'concepto_movimiento', entidadId: id, accion: 'editar',
    before: before as unknown as Record<string, unknown>,
    after: { ...before, activo: true } as unknown as Record<string, unknown>,
    usuarioId: admin.id,
  });
  revalidatePath('/configuracion/conceptos');
  return { ok: true };
}
