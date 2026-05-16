// Helpers para mantener la tabla `parte` sincronizada con `obra`, `proveedor` y
// el cliente de la obra. Cada obra/proveedor activo tiene una parte espejo que
// permite que los movimientos referencien parte_origen_id / parte_destino_id
// con consistencia. Los clientes se crean al firmar el primer presupuesto.
//
// Patrón de uso:
// - crearObra → sincronizarParteDeObra (tipo='obra')
// - editarObra → idem + actualizarParteDeClienteSiExiste (mantiene cliente)
// - eliminarObra → archivar la parte (no borrar; audit lo necesita)
// - firmarPresupuesto → sincronizarParteDeCliente (tipo='cliente')
// - crearProveedor → sincronizarParteDeProveedor (tipo='proveedor')

import { and, eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { parte, obra, proveedor, presupuesto } from '@/db/schema';

type TxOrDb = typeof db;

export async function sincronizarParteDeObra(
  obraId: string,
  data: { nombre: string; codigo: string; activo: boolean },
  cliente: TxOrDb = db,
): Promise<void> {
  const nombreParte = `${data.codigo} · ${data.nombre}`;
  const [existing] = await cliente
    .select()
    .from(parte)
    .where(and(eq(parte.obraId, obraId), eq(parte.tipo, 'obra')))
    .limit(1);

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

// Parte espejo del cliente pagador. Se crea al firmar el primer presupuesto y
// se mantiene sincronizada cuando se edita el clienteNombre o clienteEmail de
// la obra.
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

// Update-only: si la parte cliente ya existe (porque hay presupuesto firmado),
// la mantiene sincronizada. Si no existe, no hace nada — espera al firmar.
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

// Backfill idempotente. Recorre obras, proveedores y crea parte cliente para
// obras con al menos un presupuesto firmado.
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

  // Clientes: solo de obras con al menos un presupuesto firmado.
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
