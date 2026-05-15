'use server';

import { revalidatePath } from 'next/cache';
import { eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { rubro } from '@/db/schema';
import { requireRole } from '@/lib/auth/require';
import { logAudit } from '@/features/audit/log';
import { rubroInputSchema, type RubroInput } from './schema';

type Result<T extends object = object> = ({ ok: true } & T) | { ok: false; error: string };

export async function crearRubro(input: RubroInput): Promise<Result<{ id: string }>> {
  const admin = await requireRole('admin');
  const parsed = rubroInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Datos inválidos' };

  const [r] = await db.insert(rubro).values(parsed.data).returning();
  await logAudit({
    entidad: 'rubro', entidadId: r.id, accion: 'crear',
    after: r as unknown as Record<string, unknown>, usuarioId: admin.id,
  });
  revalidatePath('/configuracion/rubros');
  return { ok: true, id: r.id };
}

export async function editarRubro(
  id: string,
  input: Partial<RubroInput> & { nombre?: string },
): Promise<Result> {
  const admin = await requireRole('admin');
  const [before] = await db.select().from(rubro).where(eq(rubro.id, id));
  if (!before) return { ok: false, error: 'No existe' };

  // Build merged update only with fields that were explicitly provided.
  // This avoids accidentally wiping idPadre when the caller only wants to
  // change the name (e.g. when renaming or normalizing whitespace).
  const merged = {
    nombre: input.nombre ?? before.nombre,
    idPadre: input.idPadre !== undefined ? input.idPadre : before.idPadre,
    orden: input.orden !== undefined ? input.orden : before.orden,
    activo: input.activo !== undefined ? input.activo : before.activo,
  };
  const parsed = rubroInputSchema.safeParse(merged);
  if (!parsed.success) return { ok: false, error: 'Datos inválidos' };

  const [after] = await db.update(rubro).set(parsed.data).where(eq(rubro.id, id)).returning();
  await logAudit({
    entidad: 'rubro', entidadId: id, accion: 'editar',
    before: before as unknown as Record<string, unknown>,
    after: after as unknown as Record<string, unknown>,
    usuarioId: admin.id,
  });
  revalidatePath('/configuracion/rubros');
  return { ok: true };
}

export async function archivarRubro(id: string): Promise<Result> {
  const admin = await requireRole('admin');
  const [before] = await db.select().from(rubro).where(eq(rubro.id, id));
  if (!before) return { ok: false, error: 'No existe' };
  await db.update(rubro).set({ activo: false }).where(eq(rubro.id, id));
  await logAudit({
    entidad: 'rubro', entidadId: id, accion: 'eliminar',
    before: before as unknown as Record<string, unknown>,
    usuarioId: admin.id,
  });
  revalidatePath('/configuracion/rubros');
  return { ok: true };
}
