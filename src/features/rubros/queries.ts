import { db } from '@/db/client';
import { rubro } from '@/db/schema';
import { asc } from 'drizzle-orm';

export type RubroNode = {
  id: string; nombre: string; orden: number; activo: boolean;
  hijos: RubroNode[];
};

export async function listarRubrosArbol(): Promise<RubroNode[]> {
  const flat = await db.select().from(rubro).orderBy(asc(rubro.orden));
  const byId = new Map<string, RubroNode>();
  flat.forEach((r) => byId.set(r.id, { id: r.id, nombre: r.nombre, orden: r.orden, activo: r.activo, hijos: [] }));
  const roots: RubroNode[] = [];
  flat.forEach((r) => {
    const node = byId.get(r.id)!;
    if (r.idPadre) byId.get(r.idPadre)?.hijos.push(node);
    else roots.push(node);
  });
  return roots;
}

export async function listarRubrosPlanos() {
  return db.select().from(rubro).orderBy(asc(rubro.orden));
}
