import { and, desc, eq, isNull } from 'drizzle-orm';
import { db } from '@/db/client';
import { obra } from '@/db/schema';

export async function listarObras() {
  return db.select().from(obra).where(isNull(obra.deletedAt)).orderBy(desc(obra.createdAt));
}

export async function getObra(id: string) {
  const [o] = await db.select().from(obra)
    .where(and(eq(obra.id, id), isNull(obra.deletedAt))).limit(1);
  return o ?? null;
}

export async function getObraByCodigo(codigo: string) {
  const [o] = await db.select().from(obra)
    .where(and(eq(obra.codigo, codigo), isNull(obra.deletedAt))).limit(1);
  return o ?? null;
}

export async function listarCodigosDelAnio(anio: number) {
  const rows = await db.select({ codigo: obra.codigo }).from(obra);
  return rows.map((r) => r.codigo).filter((c) => c.startsWith(`M-${anio}-`));
}
