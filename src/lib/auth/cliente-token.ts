import { and, eq, isNull } from 'drizzle-orm';
import { db } from '@/db/client';
import { obra } from '@/db/schema';

/**
 * Lookup público de obra por cliente_token. Devuelve null si:
 *  - el token está vacío o es claramente mal formado (defensa cheap)
 *  - no existe ninguna obra con ese token
 *  - la obra fue soft-deleted
 *
 * Tokens válidos los genera `randomBytes(32).toString('base64url')` → 43 chars.
 */
export async function getObraByToken(token: string) {
  if (!token || token.length < 30) return null;
  const [o] = await db
    .select()
    .from(obra)
    .where(and(eq(obra.clienteToken, token), isNull(obra.deletedAt)))
    .limit(1);
  return o ?? null;
}
