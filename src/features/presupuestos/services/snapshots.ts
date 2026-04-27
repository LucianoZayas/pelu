import Decimal from 'decimal.js';
import { convertirAMonedaBase, type Moneda } from './currency';
import { calcularPrecioCliente, markupEfectivo } from './markup';

export interface ItemRaw {
  cantidad: Decimal;
  costoUnitario: Decimal;
  costoUnitarioMoneda: Moneda;
  markupPorcentaje: Decimal | null;
}

export interface PresupuestoCtx {
  monedaBase: Moneda;
  cotizacionUsd: Decimal;
  markupDefault: Decimal;
}

export interface ItemSnapshot {
  costoUnitarioBase: Decimal;
  markupEfectivoPorcentaje: Decimal;
  precioUnitarioCliente: Decimal;
  subtotalCosto: Decimal;
  subtotalCliente: Decimal;
}

export function calcularSnapshotItem(item: ItemRaw, ctx: PresupuestoCtx): ItemSnapshot {
  const costoBase = convertirAMonedaBase(
    item.costoUnitario, item.costoUnitarioMoneda, ctx.monedaBase, ctx.cotizacionUsd,
  );
  const markupPct = markupEfectivo(item.markupPorcentaje, ctx.markupDefault);
  const precio = calcularPrecioCliente(costoBase, markupPct);
  return {
    costoUnitarioBase: costoBase,
    markupEfectivoPorcentaje: markupPct,
    precioUnitarioCliente: precio,
    subtotalCosto: costoBase.times(item.cantidad),
    subtotalCliente: precio.times(item.cantidad),
  };
}
