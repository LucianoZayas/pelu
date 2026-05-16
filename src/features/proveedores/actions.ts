'use server';

import { revalidatePath } from 'next/cache';
import { eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { proveedor } from '@/db/schema';
import { requireRole } from '@/lib/auth/require';
import { logAudit } from '@/features/audit/log';
import { sincronizarParteDeProveedor } from '@/features/partes/auto-create';
import { proveedorInputSchema, type ProveedorInput } from './schema';

type Result<T extends object = object> = ({ ok: true } & T) | { ok: false; error: string };

export async function crearProveedor(input: ProveedorInput): Promise<Result<{ id: string }>> {
  const admin = await requireRole('admin');
  const parsed = proveedorInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'Datos inválidos' };

  const [p] = await db.insert(proveedor).values({
    nombre: parsed.data.nombre,
    cuit: parsed.data.cuit ?? null,
    contacto: parsed.data.contacto ?? null,
    esContratista: parsed.data.esContratista,
    activo: parsed.data.activo,
  }).returning();

  await sincronizarParteDeProveedor(p.id, {
    nombre: p.nombre,
    activo: p.activo,
  });

  await logAudit({
    entidad: 'proveedor', entidadId: p.id, accion: 'crear',
    after: p as unknown as Record<string, unknown>, usuarioId: admin.id,
  });
  revalidatePath('/configuracion/proveedores');
  return { ok: true, id: p.id };
}

export async function editarProveedor(id: string, input: Partial<ProveedorInput>): Promise<Result> {
  const admin = await requireRole('admin');
  const [before] = await db.select().from(proveedor).where(eq(proveedor.id, id));
  if (!before) return { ok: false, error: 'No existe' };

  const merged: ProveedorInput = {
    nombre: input.nombre ?? before.nombre,
    cuit: input.cuit !== undefined ? input.cuit : before.cuit,
    contacto: input.contacto !== undefined ? input.contacto : before.contacto,
    esContratista: input.esContratista !== undefined ? input.esContratista : before.esContratista,
    activo: input.activo !== undefined ? input.activo : before.activo,
  };
  const parsed = proveedorInputSchema.safeParse(merged);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'Datos inválidos' };

  const [after] = await db.update(proveedor).set({
    nombre: parsed.data.nombre,
    cuit: parsed.data.cuit ?? null,
    contacto: parsed.data.contacto ?? null,
    esContratista: parsed.data.esContratista,
    activo: parsed.data.activo,
  }).where(eq(proveedor.id, id)).returning();

  await sincronizarParteDeProveedor(after.id, {
    nombre: after.nombre,
    activo: after.activo,
  });

  await logAudit({
    entidad: 'proveedor', entidadId: id, accion: 'editar',
    before: before as unknown as Record<string, unknown>,
    after: after as unknown as Record<string, unknown>,
    usuarioId: admin.id,
  });
  revalidatePath('/configuracion/proveedores');
  return { ok: true };
}

export async function archivarProveedor(id: string): Promise<Result> {
  const admin = await requireRole('admin');
  const [before] = await db.select().from(proveedor).where(eq(proveedor.id, id));
  if (!before) return { ok: false, error: 'No existe' };
  await db.update(proveedor).set({ activo: false }).where(eq(proveedor.id, id));
  await sincronizarParteDeProveedor(id, { nombre: before.nombre, activo: false });
  await logAudit({
    entidad: 'proveedor', entidadId: id, accion: 'eliminar',
    before: before as unknown as Record<string, unknown>,
    usuarioId: admin.id,
  });
  revalidatePath('/configuracion/proveedores');
  return { ok: true };
}

export async function restaurarProveedor(id: string): Promise<Result> {
  const admin = await requireRole('admin');
  const [before] = await db.select().from(proveedor).where(eq(proveedor.id, id));
  if (!before) return { ok: false, error: 'No existe' };
  await db.update(proveedor).set({ activo: true }).where(eq(proveedor.id, id));
  await sincronizarParteDeProveedor(id, { nombre: before.nombre, activo: true });
  await logAudit({
    entidad: 'proveedor', entidadId: id, accion: 'editar',
    before: before as unknown as Record<string, unknown>,
    after: { ...before, activo: true } as unknown as Record<string, unknown>,
    usuarioId: admin.id,
  });
  revalidatePath('/configuracion/proveedores');
  return { ok: true };
}
