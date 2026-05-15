'use server';

import { revalidatePath } from 'next/cache';
import { eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { cuenta } from '@/db/schema';
import { requireRole } from '@/lib/auth/require';
import { logAudit } from '@/features/audit/log';
import { cuentaInputSchema, type CuentaInput } from './schema';

type Result<T extends object = object> = ({ ok: true } & T) | { ok: false; error: string };

export async function crearCuenta(input: CuentaInput): Promise<Result<{ id: string }>> {
  const admin = await requireRole('admin');
  const parsed = cuentaInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Datos inválidos' };

  const [c] = await db.insert(cuenta).values(parsed.data).returning();
  await logAudit({
    entidad: 'cuenta', entidadId: c.id, accion: 'crear',
    after: c as unknown as Record<string, unknown>, usuarioId: admin.id,
  });
  revalidatePath('/configuracion/cuentas');
  return { ok: true, id: c.id };
}

export async function editarCuenta(id: string, input: Partial<CuentaInput>): Promise<Result> {
  const admin = await requireRole('admin');
  const [before] = await db.select().from(cuenta).where(eq(cuenta.id, id));
  if (!before) return { ok: false, error: 'No existe' };

  const merged = {
    nombre: input.nombre ?? before.nombre,
    moneda: (input.moneda ?? before.moneda) as 'USD' | 'ARS',
    tipo: (input.tipo ?? before.tipo) as 'caja' | 'banco',
    orden: input.orden !== undefined ? input.orden : before.orden,
    notas: input.notas !== undefined ? input.notas : before.notas,
    activo: input.activo !== undefined ? input.activo : before.activo,
  };
  const parsed = cuentaInputSchema.safeParse(merged);
  if (!parsed.success) return { ok: false, error: 'Datos inválidos' };

  const [after] = await db.update(cuenta).set(parsed.data).where(eq(cuenta.id, id)).returning();
  await logAudit({
    entidad: 'cuenta', entidadId: id, accion: 'editar',
    before: before as unknown as Record<string, unknown>,
    after: after as unknown as Record<string, unknown>,
    usuarioId: admin.id,
  });
  revalidatePath('/configuracion/cuentas');
  return { ok: true };
}

export async function archivarCuenta(id: string): Promise<Result> {
  const admin = await requireRole('admin');
  const [before] = await db.select().from(cuenta).where(eq(cuenta.id, id));
  if (!before) return { ok: false, error: 'No existe' };
  await db.update(cuenta).set({ activo: false }).where(eq(cuenta.id, id));
  await logAudit({
    entidad: 'cuenta', entidadId: id, accion: 'eliminar',
    before: before as unknown as Record<string, unknown>,
    usuarioId: admin.id,
  });
  revalidatePath('/configuracion/cuentas');
  return { ok: true };
}

export async function restaurarCuenta(id: string): Promise<Result> {
  const admin = await requireRole('admin');
  const [before] = await db.select().from(cuenta).where(eq(cuenta.id, id));
  if (!before) return { ok: false, error: 'No existe' };
  await db.update(cuenta).set({ activo: true }).where(eq(cuenta.id, id));
  await logAudit({
    entidad: 'cuenta', entidadId: id, accion: 'editar',
    before: before as unknown as Record<string, unknown>,
    after: { ...before, activo: true } as unknown as Record<string, unknown>,
    usuarioId: admin.id,
  });
  revalidatePath('/configuracion/cuentas');
  return { ok: true };
}
