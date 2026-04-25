import { redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { db } from '@/db/client';
import { usuario } from '@/db/schema';
import type { SessionUser } from './types';

export async function getSessionUser(): Promise<SessionUser | null> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return null;

  const [u] = await db.select().from(usuario).where(eq(usuario.id, data.user.id)).limit(1);
  if (!u || !u.activo) return null;

  return { id: u.id, email: u.email, nombre: u.nombre, rol: u.rol };
}

export async function requireSession(): Promise<SessionUser> {
  const u = await getSessionUser();
  if (!u) redirect('/login');
  return u;
}

export async function requireRole(rol: 'admin'): Promise<SessionUser> {
  const u = await requireSession();
  if (u.rol !== rol) {
    throw new Response('Forbidden', { status: 403 });
  }
  return u;
}
