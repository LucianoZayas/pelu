// Helpers para mantener la tabla `parte` sincronizada con `obra` y `proveedor`.
//
// Cada obra y proveedor activo del sistema debe tener una parte espejo que
// permita que los movimientos referencien parte_origen_id / parte_destino_id
// con consistencia. Esto habilita filtros tipo "todos los movimientos cuya
// parte es la obra X" sin tener que mantener queries separadas por tipo.
//
// El patrón de uso es:
// - crearObra → llamar a sincronizarParteDeObra después del insert
// - editarObra → idem (mantiene el nombre actualizado)
// - eliminarObra → archivar la parte (no borrar, audit lo necesita)
// - mismo set de funciones para proveedor

import { eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { parte, obra, proveedor } from '@/db/schema';

type TxOrDb = typeof db;

export async function sincronizarParteDeObra(
  obraId: string,
  data: { nombre: string; codigo: string; activo: boolean },
  cliente: TxOrDb = db,
): Promise<void> {
  const nombreParte = `${data.codigo} · ${data.nombre}`;
  const [existing] = await cliente.select().from(parte).where(eq(parte.obraId, obraId)).limit(1);

  if (existing) {
    await cliente.update(parte).set({
      nombre: nombreParte,
      activo: data.activo,
      updatedAt: new Date(),
    }).where(eq(parte.id, existing.id));
    return;
  }

  await cliente.insert(parte).values({
    tipo: 'obra',
    nombre: nombreParte,
    obraId,
    activo: data.activo,
  });
}

export async function sincronizarParteDeProveedor(
  proveedorId: string,
  data: { nombre: string; activo: boolean },
  cliente: TxOrDb = db,
): Promise<void> {
  const [existing] = await cliente.select().from(parte).where(eq(parte.proveedorId, proveedorId)).limit(1);

  if (existing) {
    await cliente.update(parte).set({
      nombre: data.nombre,
      activo: data.activo,
      updatedAt: new Date(),
    }).where(eq(parte.id, existing.id));
    return;
  }

  await cliente.insert(parte).values({
    tipo: 'proveedor',
    nombre: data.nombre,
    proveedorId,
    activo: data.activo,
  });
}

// Backfill idempotente: recorre todas las obras y proveedores existentes y
// asegura que tengan parte espejo. Útil cuando se introduce esta función en
// un sistema que ya tiene datos cargados (ejecutar una vez desde el seed).
export async function backfillPartesEspejo(): Promise<{ obras: number; proveedores: number }> {
  const obras = await db.select().from(obra);
  let obrasContador = 0;
  for (const o of obras) {
    if (o.deletedAt) continue;
    await sincronizarParteDeObra(o.id, {
      nombre: o.nombre,
      codigo: o.codigo,
      activo: o.estado !== 'cancelada',
    });
    obrasContador++;
  }

  const proveedores = await db.select().from(proveedor);
  let provContador = 0;
  for (const p of proveedores) {
    await sincronizarParteDeProveedor(p.id, {
      nombre: p.nombre,
      activo: p.activo,
    });
    provContador++;
  }

  return { obras: obrasContador, proveedores: provContador };
}
