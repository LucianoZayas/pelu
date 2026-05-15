import { db } from '@/db/client';
import { parte, obra, proveedor } from '@/db/schema';
import { asc, eq } from 'drizzle-orm';

export type ParteListItem = {
  id: string;
  tipo: 'empresa' | 'obra' | 'socio' | 'empleado' | 'proveedor' | 'externo';
  nombre: string;
  obraId: string | null;
  proveedorId: string | null;
  obraCodigo: string | null;
  proveedorActivo: boolean | null;
  datos: Record<string, unknown> | null;
  activo: boolean;
};

export async function listarPartes(): Promise<ParteListItem[]> {
  const rows = await db
    .select({
      id: parte.id,
      tipo: parte.tipo,
      nombre: parte.nombre,
      obraId: parte.obraId,
      proveedorId: parte.proveedorId,
      datos: parte.datos,
      activo: parte.activo,
      obraCodigo: obra.codigo,
      proveedorActivo: proveedor.activo,
    })
    .from(parte)
    .leftJoin(obra, eq(obra.id, parte.obraId))
    .leftJoin(proveedor, eq(proveedor.id, parte.proveedorId))
    .orderBy(asc(parte.tipo), asc(parte.nombre));

  return rows.map((r) => ({
    id: r.id,
    tipo: r.tipo,
    nombre: r.nombre,
    obraId: r.obraId,
    proveedorId: r.proveedorId,
    obraCodigo: r.obraCodigo,
    proveedorActivo: r.proveedorActivo,
    datos: r.datos as Record<string, unknown> | null,
    activo: r.activo,
  }));
}

export async function listarPartesActivas() {
  return db.select().from(parte).where(eq(parte.activo, true)).orderBy(asc(parte.tipo), asc(parte.nombre));
}

export async function obtenerParte(id: string) {
  const [row] = await db.select().from(parte).where(eq(parte.id, id));
  return row ?? null;
}
