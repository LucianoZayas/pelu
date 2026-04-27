import Decimal from 'decimal.js';

export type Moneda = 'USD' | 'ARS';

export function convertirAMonedaBase(
  monto: Decimal,
  origen: Moneda,
  base: Moneda,
  cotizacionUsd: Decimal,
): Decimal {
  if (origen === base) return monto;
  if (cotizacionUsd.isZero()) {
    throw new Error('cotizacion_usd no puede ser 0 cuando hay conversión');
  }
  if (origen === 'ARS' && base === 'USD') return monto.div(cotizacionUsd);
  if (origen === 'USD' && base === 'ARS') return monto.times(cotizacionUsd);
  throw new Error(`Conversión no soportada ${origen}→${base}`);
}
