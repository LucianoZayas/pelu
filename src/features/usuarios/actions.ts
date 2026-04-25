'use server';

import { revalidatePath } from 'next/cache';
import { randomBytes } from 'crypto';
import { eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { usuario } from '@/db/schema';
import { requireRole } from '@/lib/auth/require';
import { logAudit } from '@/features/audit/log';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { invitarUsuarioSchema, editarUsuarioSchema, type InvitarUsuarioInput, type EditarUsuarioInput } from './schema';

type Result = { ok: true } | { ok: false; error: string };

export async function invitarUsuario(input: InvitarUsuarioInput): Promise<Result> {
  const admin = await requireRole('admin');
  const parsed = invitarUsuarioSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Datos inválidos' };

  const sb = createSupabaseAdminClient();
  const tempPassword = randomBytes(12).toString('base64url');
  const { data, error } = await sb.auth.admin.createUser({
    email: parsed.data.email, password: tempPassword, email_confirm: true,
  });
  if (error || !data.user) return { ok: false, error: error?.message ?? 'Error creando user' };

  await db.insert(usuario).values({
    id: data.user.id, email: parsed.data.email,
    nombre: parsed.data.nombre, rol: parsed.data.rol, activo: true,
  });

  await sb.auth.admin.generateLink({ type: 'recovery', email: parsed.data.email });

  await logAudit({
    entidad: 'usuario', entidadId: data.user.id, accion: 'crear',
    after: { email: parsed.data.email, rol: parsed.data.rol },
    descripcionHumana: `${admin.nombre} invitó a ${parsed.data.email} (${parsed.data.rol})`,
    usuarioId: admin.id,
  });
  revalidatePath('/configuracion/usuarios');
  return { ok: true };
}

export async function editarUsuario(id: string, input: EditarUsuarioInput): Promise<Result> {
  const admin = await requireRole('admin');
  const parsed = editarUsuarioSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Datos inválidos' };
  const [before] = await db.select().from(usuario).where(eq(usuario.id, id));
  if (!before) return { ok: false, error: 'No existe' };
  const [after] = await db.update(usuario).set(parsed.data).where(eq(usuario.id, id)).returning();
  await logAudit({
    entidad: 'usuario', entidadId: id, accion: 'editar',
    before: before as unknown as Record<string, unknown>,
    after: after as unknown as Record<string, unknown>,
    usuarioId: admin.id,
  });
  revalidatePath('/configuracion/usuarios');
  return { ok: true };
}

export async function desactivarUsuario(id: string): Promise<Result> {
  const admin = await requireRole('admin');
  if (id === admin.id) return { ok: false, error: 'No podés desactivarte a vos mismo' };
  const [before] = await db.select().from(usuario).where(eq(usuario.id, id));
  if (!before) return { ok: false, error: 'No existe' };
  await db.update(usuario).set({ activo: false }).where(eq(usuario.id, id));
  await logAudit({
    entidad: 'usuario', entidadId: id, accion: 'eliminar',
    before: before as unknown as Record<string, unknown>,
    usuarioId: admin.id,
  });
  revalidatePath('/configuracion/usuarios');
  return { ok: true };
}
