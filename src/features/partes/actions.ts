'use server';

import { revalidatePath } from 'next/cache';
import { eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { parte } from '@/db/schema';
import { requireRole } from '@/lib/auth/require';
import { logAudit } from '@/features/audit/log';
import { parteInputSchema, type ParteInput } from './schema';

type Result<T extends object = object> = ({ ok: true } & T) | { ok: false; error: string };

export async function crearParte(input: ParteInput): Promise<Result<{ id: string }>> {
  const admin = await requireRole('admin');
  const parsed = parteInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'Datos inválidos' };

  const [p] = await db.insert(parte).values({
    tipo: parsed.data.tipo,
    nombre: parsed.data.nombre,
    datos: parsed.data.datos ?? null,
    activo: parsed.data.activo,
  }).returning();

  await logAudit({
    entidad: 'parte', entidadId: p.id, accion: 'crear',
    after: p as unknown as Record<string, unknown>, usuarioId: admin.id,
  });
  revalidatePath('/configuracion/partes');
  return { ok: true, id: p.id };
}

export async function editarParte(id: string, input: Partial<ParteInput>): Promise<Result> {
  const admin = await requireRole('admin');
  const [before] = await db.select().from(parte).where(eq(parte.id, id));
  if (!before) return { ok: false, error: 'No existe' };

  // Partes tipo obra/proveedor no se editan acá: están atadas a la entidad real.
  if (before.tipo === 'obra' || before.tipo === 'proveedor') {
    return { ok: false, error: 'Las partes tipo obra o proveedor se gestionan desde Obras / Proveedores' };
  }

  const merged: ParteInput = {
    tipo: (input.tipo ?? before.tipo) as ParteInput['tipo'],
    nombre: input.nombre ?? before.nombre,
    datos: input.datos !== undefined ? input.datos : (before.datos as ParteInput['datos']),
    activo: input.activo !== undefined ? input.activo : before.activo,
  };
  const parsed = parteInputSchema.safeParse(merged);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'Datos inválidos' };

  const [after] = await db.update(parte).set({
    tipo: parsed.data.tipo,
    nombre: parsed.data.nombre,
    datos: parsed.data.datos ?? null,
    activo: parsed.data.activo,
    updatedAt: new Date(),
  }).where(eq(parte.id, id)).returning();

  await logAudit({
    entidad: 'parte', entidadId: id, accion: 'editar',
    before: before as unknown as Record<string, unknown>,
    after: after as unknown as Record<string, unknown>,
    usuarioId: admin.id,
  });
  revalidatePath('/configuracion/partes');
  return { ok: true };
}

export async function archivarParte(id: string): Promise<Result> {
  const admin = await requireRole('admin');
  const [before] = await db.select().from(parte).where(eq(parte.id, id));
  if (!before) return { ok: false, error: 'No existe' };
  if (before.tipo === 'obra' || before.tipo === 'proveedor') {
    return { ok: false, error: 'Las partes tipo obra o proveedor se archivan desde Obras / Proveedores' };
  }
  await db.update(parte).set({ activo: false }).where(eq(parte.id, id));
  await logAudit({
    entidad: 'parte', entidadId: id, accion: 'eliminar',
    before: before as unknown as Record<string, unknown>,
    usuarioId: admin.id,
  });
  revalidatePath('/configuracion/partes');
  return { ok: true };
}

export async function restaurarParte(id: string): Promise<Result> {
  const admin = await requireRole('admin');
  const [before] = await db.select().from(parte).where(eq(parte.id, id));
  if (!before) return { ok: false, error: 'No existe' };
  await db.update(parte).set({ activo: true }).where(eq(parte.id, id));
  await logAudit({
    entidad: 'parte', entidadId: id, accion: 'editar',
    before: before as unknown as Record<string, unknown>,
    after: { ...before, activo: true } as unknown as Record<string, unknown>,
    usuarioId: admin.id,
  });
  revalidatePath('/configuracion/partes');
  return { ok: true };
}
