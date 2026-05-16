import { db } from '@/db/client';
import {
  certificacion, avanceItem, itemPresupuesto, presupuesto, obra, rubro, usuario,
} from '@/db/schema';
import { and, asc, desc, eq, max, sql } from 'drizzle-orm';

export async function listarCertificacionesDeObra(obraId: string) {
  return db
    .select({
      id: certificacion.id,
      numero: certificacion.numero,
      fecha: certificacion.fecha,
      estado: certificacion.estado,
      totalNeto: certificacion.totalNeto,
      totalHonorarios: certificacion.totalHonorarios,
      totalGeneral: certificacion.totalGeneral,
      moneda: certificacion.moneda,
      descripcion: certificacion.descripcion,
      fechaEmision: certificacion.fechaEmision,
      fechaCobro: certificacion.fechaCobro,
      presupuestoId: certificacion.presupuestoId,
      presupuestoNumero: presupuesto.numero,
      createdBy: usuario.nombre,
      createdAt: certificacion.createdAt,
    })
    .from(certificacion)
    .innerJoin(presupuesto, eq(certificacion.presupuestoId, presupuesto.id))
    .leftJoin(usuario, eq(usuario.id, certificacion.createdBy))
    .where(eq(presupuesto.obraId, obraId))
    .orderBy(desc(certificacion.fecha), desc(certificacion.numero));
}

export async function listarCertificacionesEmitidasDeObra(obraId: string) {
  const rows = await listarCertificacionesDeObra(obraId);
  return rows.filter((c) => c.estado === 'emitida' || c.estado === 'cobrada');
}

export async function obtenerCertificacion(id: string) {
  const [cert] = await db
    .select()
    .from(certificacion)
    .where(eq(certificacion.id, id));
  return cert ?? null;
}

export async function obtenerCertificacionConPresupuesto(id: string) {
  const [row] = await db
    .select({
      cert: certificacion,
      presupuesto: presupuesto,
      obra: obra,
    })
    .from(certificacion)
    .innerJoin(presupuesto, eq(certificacion.presupuestoId, presupuesto.id))
    .innerJoin(obra, eq(presupuesto.obraId, obra.id))
    .where(eq(certificacion.id, id))
    .limit(1);
  return row ?? null;
}

export type AvanceRow = {
  id: string;
  itemPresupuestoId: string;
  itemDescripcion: string;
  itemUnidad: string;
  itemCantidad: string;
  itemPrecioCliente: string;
  itemPorcentajeHonorariosOverride: string | null;
  rubroNombre: string | null;
  porcentajeAcumulado: string;
  porcentajeAnterior: string;
  montoNetoFacturado: string;
  montoHonorariosFacturado: string;
  porcentajeHonorariosAplicado: string;
};

export async function listarAvancesDeCertificacion(certId: string): Promise<AvanceRow[]> {
  const rows = await db
    .select({
      id: avanceItem.id,
      itemPresupuestoId: avanceItem.itemPresupuestoId,
      itemDescripcion: itemPresupuesto.descripcion,
      itemUnidad: itemPresupuesto.unidad,
      itemCantidad: itemPresupuesto.cantidad,
      itemPrecioCliente: itemPresupuesto.precioUnitarioCliente,
      itemPorcentajeHonorariosOverride: itemPresupuesto.porcentajeHonorarios,
      rubroNombre: rubro.nombre,
      porcentajeAcumulado: avanceItem.porcentajeAcumulado,
      porcentajeAnterior: avanceItem.porcentajeAnterior,
      montoNetoFacturado: avanceItem.montoNetoFacturado,
      montoHonorariosFacturado: avanceItem.montoHonorariosFacturado,
      porcentajeHonorariosAplicado: avanceItem.porcentajeHonorariosAplicado,
    })
    .from(avanceItem)
    .innerJoin(itemPresupuesto, eq(avanceItem.itemPresupuestoId, itemPresupuesto.id))
    .leftJoin(rubro, eq(itemPresupuesto.rubroId, rubro.id))
    .where(eq(avanceItem.certificacionId, certId))
    .orderBy(asc(itemPresupuesto.orden));
  return rows as AvanceRow[];
}

// Devuelve el porcentaje acumulado del último avance previo a esta certificación
// para cada item. Útil para calcular "porcentaje_anterior" al crear nuevas certs.
export async function obtenerUltimosAcumuladosDePresupuesto(
  presupuestoId: string,
  excluirCertId?: string,
): Promise<Map<string, number>> {
  const cond = [
    eq(certificacion.presupuestoId, presupuestoId),
    sql`${certificacion.estado} != 'anulada'`,
  ];
  if (excluirCertId) cond.push(sql`${certificacion.id} != ${excluirCertId}`);

  const rows = await db
    .select({
      itemId: avanceItem.itemPresupuestoId,
      maxAcum: max(avanceItem.porcentajeAcumulado),
    })
    .from(avanceItem)
    .innerJoin(certificacion, eq(certificacion.id, avanceItem.certificacionId))
    .where(and(...cond))
    .groupBy(avanceItem.itemPresupuestoId);

  const map = new Map<string, number>();
  for (const r of rows) {
    map.set(r.itemId, Number(r.maxAcum ?? 0));
  }
  return map;
}

export async function siguienteNumero(presupuestoId: string): Promise<number> {
  const [r] = await db
    .select({ max: max(certificacion.numero) })
    .from(certificacion)
    .where(eq(certificacion.presupuestoId, presupuestoId));
  return (Number(r?.max ?? 0)) + 1;
}
