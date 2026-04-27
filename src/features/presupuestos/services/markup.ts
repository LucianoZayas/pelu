import Decimal from 'decimal.js';
import { D } from '@/lib/money/decimal';

export function markupEfectivo(itemMarkup: Decimal | null, defaultMarkup: Decimal): Decimal {
  return itemMarkup ?? defaultMarkup;
}

export function calcularPrecioCliente(costoBase: Decimal, markupPct: Decimal): Decimal {
  const factor = D(1).plus(markupPct.div(100));
  return costoBase.times(factor);
}
