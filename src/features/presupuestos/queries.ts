import { and, asc, desc, eq, isNull } from 'drizzle-orm';
import { db } from '@/db/client';
import { presupuesto, itemPresupuesto, rubro, obra } from '@/db/schema';

export async function listarPresupuestosDeObra(obraId: string) {
  return db.select().from(presupuesto)
    .where(and(eq(presupuesto.obraId, obraId), isNull(presupuesto.deletedAt)))
    .orderBy(asc(presupuesto.numero));
}

export async function getPresupuesto(id: string) {
  const [p] = await db.select().from(presupuesto)
    .where(and(eq(presupuesto.id, id), isNull(presupuesto.deletedAt))).limit(1);
  if (!p) return null;
  const [o] = await db.select().from(obra).where(eq(obra.id, p.obraId));
  return { ...p, obra: o };
}

export async function getItemsConRubros(presupuestoId: string) {
  return db.select({
    item: itemPresupuesto,
    rubro: rubro,
  }).from(itemPresupuesto)
    .leftJoin(rubro, eq(itemPresupuesto.rubroId, rubro.id))
    .where(and(eq(itemPresupuesto.presupuestoId, presupuestoId), isNull(itemPresupuesto.deletedAt)))
    .orderBy(asc(itemPresupuesto.orden));
}

export async function getMaxNumero(obraId: string): Promise<number> {
  const rows = await db.select({ numero: presupuesto.numero }).from(presupuesto)
    .where(eq(presupuesto.obraId, obraId)).orderBy(desc(presupuesto.numero)).limit(1);
  return rows[0]?.numero ?? 0;
}
