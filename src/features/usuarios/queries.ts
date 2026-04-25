import { db } from '@/db/client';
import { usuario } from '@/db/schema';
import { asc } from 'drizzle-orm';
export async function listarUsuarios() {
  return db.select().from(usuario).orderBy(asc(usuario.nombre));
}
