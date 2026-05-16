import { db } from '@/db/client';
import { itemPresupuesto, presupuesto, rubro, obra } from '@/db/schema';
import { and, asc, eq, isNull } from 'drizzle-orm';

export type ItemAvance = {
  id: string;
  rubroId: string;
  rubroNombre: string;
  orden: number;
  descripcion: string;
  unidad: string;
  cantidad: string;
  precioUnitarioCliente: string;
  porcentajeAvance: string;
  porcentajeHonorarios: string | null;
  notas: string | null;
};

export type AvanceObra = {
  presupuestoId: string;
  presupuestoNumero: number;
  presupuestoTipo: 'original' | 'adicional';
  fechaFirma: Date | null;
  obraId: string;
  obraCodigo: string;
  obraNombre: string;
  obraPorcentajeHonorarios: string;
  monedaBase: 'USD' | 'ARS';
  items: ItemAvance[];
  totales: {
    cantidadItems: number;
    itemsCompletados: number;
    progresoGlobal: number; // 0-100, ponderado por monto del item
    montoTotal: number; // suma de items × precio
    montoEjecutado: number; // suma de items × precio × % avance
  };
};

// Devuelve el "avance" de la obra (todos los items del último presupuesto
// firmado original/adicional con su % avance actual).
export async function obtenerAvanceDeObra(obraId: string): Promise<AvanceObra | null> {
  const [o] = await db.select().from(obra).where(eq(obra.id, obraId)).limit(1);
  if (!o) return null;

  // Tomamos el original firmado. Si no hay, no hay avance que mostrar.
  // (Por ahora ignoramos adicionales para mantenerlo simple — el usuario quería
  // simpleza. Cuando haga falta, agregar selector de presupuesto.)
  const [p] = await db
    .select()
    .from(presupuesto)
    .where(and(
      eq(presupuesto.obraId, obraId),
      eq(presupuesto.estado, 'firmado'),
      eq(presupuesto.tipo, 'original'),
      isNull(presupuesto.deletedAt),
    ))
    .limit(1);
  if (!p) return null;

  const items = await db
    .select({
      item: itemPresupuesto,
      rubroNombre: rubro.nombre,
      rubroId: rubro.id,
    })
    .from(itemPresupuesto)
    .leftJoin(rubro, eq(itemPresupuesto.rubroId, rubro.id))
    .where(and(eq(itemPresupuesto.presupuestoId, p.id), isNull(itemPresupuesto.deletedAt)))
    .orderBy(asc(itemPresupuesto.orden));

  let montoTotal = 0;
  let montoEjecutado = 0;
  let completados = 0;
  const itemsMapped: ItemAvance[] = items.map(({ item, rubroNombre, rubroId }) => {
    const monto = Number(item.precioUnitarioCliente) * Number(item.cantidad);
    const pct = Number(item.porcentajeAvance);
    montoTotal += monto;
    montoEjecutado += monto * (pct / 100);
    if (pct >= 100) completados++;
    return {
      id: item.id,
      rubroId: rubroId ?? '',
      rubroNombre: rubroNombre ?? 'Sin rubro',
      orden: item.orden,
      descripcion: item.descripcion,
      unidad: item.unidad,
      cantidad: item.cantidad,
      precioUnitarioCliente: item.precioUnitarioCliente,
      porcentajeAvance: item.porcentajeAvance,
      porcentajeHonorarios: item.porcentajeHonorarios,
      notas: item.notas,
    };
  });

  return {
    presupuestoId: p.id,
    presupuestoNumero: p.numero,
    presupuestoTipo: p.tipo,
    fechaFirma: p.fechaFirma,
    obraId: o.id,
    obraCodigo: o.codigo,
    obraNombre: o.nombre,
    obraPorcentajeHonorarios: o.porcentajeHonorarios,
    monedaBase: o.monedaBase,
    items: itemsMapped,
    totales: {
      cantidadItems: itemsMapped.length,
      itemsCompletados: completados,
      progresoGlobal: montoTotal > 0 ? (montoEjecutado / montoTotal) * 100 : 0,
      montoTotal,
      montoEjecutado,
    },
  };
}
