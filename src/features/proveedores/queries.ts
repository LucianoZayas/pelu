import { db } from '@/db/client';
import { proveedor } from '@/db/schema';
import { asc, eq } from 'drizzle-orm';

export async function listarProveedores() {
  return db.select().from(proveedor).orderBy(asc(proveedor.nombre));
}

export async function listarProveedoresActivos() {
  return db.select().from(proveedor).where(eq(proveedor.activo, true)).orderBy(asc(proveedor.nombre));
}

export async function obtenerProveedor(id: string) {
  const [row] = await db.select().from(proveedor).where(eq(proveedor.id, id));
  return row ?? null;
}
