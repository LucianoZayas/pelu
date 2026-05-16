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

import { eq, and } from 'drizzle-orm';
import { db } from '@/db/client';
import { parte, obra, proveedor, presupuesto } from '@/db/schema';

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

// Sincroniza una parte tipo='cliente' enlazada a una obra. Se llama al firmar
// el primer presupuesto de la obra y al editar la obra si cambia clienteNombre.
// La PK lógica es obra_id (cada obra tiene una sola parte cliente).
export async function sincronizarParteDeCliente(
  obraId: string,
  data: { nombre: string; email?: string | null; activo: boolean },
  cliente: TxOrDb = db,
): Promise<void> {
  const [existing] = await cliente
    .select()
    .from(parte)
    .where(and(eq(parte.obraId, obraId), eq(parte.tipo, 'cliente')))
    .limit(1);

  const datos = data.email ? { email: data.email } : null;

  if (existing) {
    await cliente.update(parte).set({
      nombre: data.nombre,
      datos,
      activo: data.activo,
      updatedAt: new Date(),
    }).where(eq(parte.id, existing.id));
    return;
  }

  await cliente.insert(parte).values({
    tipo: 'cliente',
    nombre: data.nombre,
    obraId,
    datos,
    activo: data.activo,
  });
}

// Solo actualiza, no crea: para usar en editarObra cuando cambia clienteNombre/email.
// Si la obra todavía no tiene presupuesto firmado, no hay parte cliente — y este
// helper NO la crea (eso pasa al firmar el primer presupuesto).
export async function actualizarParteDeClienteSiExiste(
  obraId: string,
  data: { nombre: string; email?: string | null },
  cliente: TxOrDb = db,
): Promise<void> {
  const [existing] = await cliente
    .select()
    .from(parte)
    .where(and(eq(parte.obraId, obraId), eq(parte.tipo, 'cliente')))
    .limit(1);
  if (!existing) return;
  await cliente.update(parte).set({
    nombre: data.nombre,
    datos: data.email ? { email: data.email } : null,
    updatedAt: new Date(),
  }).where(eq(parte.id, existing.id));
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
export async function backfillPartesEspejo(): Promise<{
  obras: number;
  proveedores: number;
  clientes: number;
}> {
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

  // Backfill de clientes: una parte tipo='cliente' por cada obra que tenga al
  // menos un presupuesto firmado. Las obras en borrador (sin nada firmado)
  // todavía no tienen cliente "aceptado", entonces no crean parte.
  const obrasConFirmado = await db
    .selectDistinct({ obraId: presupuesto.obraId })
    .from(presupuesto)
    .where(eq(presupuesto.estado, 'firmado'));
  let clientesContador = 0;
  for (const { obraId } of obrasConFirmado) {
    const [o] = await db.select().from(obra).where(eq(obra.id, obraId)).limit(1);
    if (!o || o.deletedAt) continue;
    await sincronizarParteDeCliente(obraId, {
      nombre: o.clienteNombre,
      email: o.clienteEmail,
      activo: true,
    });
    clientesContador++;
  }

  return { obras: obrasContador, proveedores: provContador, clientes: clientesContador };
}
