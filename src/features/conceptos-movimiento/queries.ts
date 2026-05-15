import { db } from '@/db/client';
import { conceptoMovimiento } from '@/db/schema';
import { asc, eq } from 'drizzle-orm';

export async function listarConceptos() {
  return db.select().from(conceptoMovimiento).orderBy(asc(conceptoMovimiento.orden), asc(conceptoMovimiento.nombre));
}

export async function listarConceptosActivos() {
  return db.select().from(conceptoMovimiento)
    .where(eq(conceptoMovimiento.activo, true))
    .orderBy(asc(conceptoMovimiento.orden), asc(conceptoMovimiento.nombre));
}

export async function obtenerConcepto(id: string) {
  const [row] = await db.select().from(conceptoMovimiento).where(eq(conceptoMovimiento.id, id));
  return row ?? null;
}

export async function obtenerConceptoPorCodigo(codigo: string) {
  const [row] = await db.select().from(conceptoMovimiento).where(eq(conceptoMovimiento.codigo, codigo));
  return row ?? null;
}
