import Decimal from 'decimal.js';
import { D } from '@/lib/money/decimal';

export interface ItemAgg {
  rubroId: string;
  subtotalCosto: Decimal;
  subtotalCliente: Decimal;
}

export interface Totales {
  totalCosto: Decimal;
  totalCliente: Decimal;
  porRubro: Record<string, { subtotalCosto: Decimal; subtotalCliente: Decimal }>;
}

export function calcularTotales(items: ItemAgg[]): Totales {
  const porRubro: Totales['porRubro'] = {};
  let totalCosto = D(0);
  let totalCliente = D(0);
  for (const i of items) {
    if (!porRubro[i.rubroId]) porRubro[i.rubroId] = { subtotalCosto: D(0), subtotalCliente: D(0) };
    porRubro[i.rubroId].subtotalCosto = porRubro[i.rubroId].subtotalCosto.plus(i.subtotalCosto);
    porRubro[i.rubroId].subtotalCliente = porRubro[i.rubroId].subtotalCliente.plus(i.subtotalCliente);
    totalCosto = totalCosto.plus(i.subtotalCosto);
    totalCliente = totalCliente.plus(i.subtotalCliente);
  }
  return { totalCosto, totalCliente, porRubro };
}
