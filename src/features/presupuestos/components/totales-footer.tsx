'use client';
import { useFormContext, useWatch } from 'react-hook-form';
import { D } from '@/lib/money/decimal';
import { calcularSnapshotItem } from '@/features/presupuestos/services/snapshots';

export function TotalesFooter({ monedaBase }: { monedaBase: 'USD' | 'ARS' }) {
  const { control } = useFormContext();
  const data = useWatch({ control });
  let totCosto = D(0); let totCliente = D(0);
  const cot = D(data.cotizacionUsd ?? '0');
  const def = D(data.markupDefaultPorcentaje ?? '0');
  for (const r of data.rubros ?? []) {
    for (const it of r.items ?? []) {
      try {
        const s = calcularSnapshotItem({
          cantidad: D(it.cantidad || '0'),
          costoUnitario: D(it.costoUnitario || '0'),
          costoUnitarioMoneda: it.costoUnitarioMoneda,
          markupPorcentaje: it.markupPorcentaje ? D(it.markupPorcentaje) : null,
        }, { monedaBase, cotizacionUsd: cot, markupDefault: def });
        totCosto = totCosto.plus(s.subtotalCosto);
        totCliente = totCliente.plus(s.subtotalCliente);
      } catch { /* mientras se tipea, valores intermedios pueden tirar */ }
    }
  }
  return (
    <footer className="sticky bottom-0 bg-white border-t p-4 flex justify-end gap-8">
      <div><span className="text-muted-foreground text-sm">Costo total: </span><span className="font-semibold">{totCosto.toFixed(2)} {monedaBase}</span></div>
      <div><span className="text-muted-foreground text-sm">Cliente total: </span><span className="font-semibold text-lg">{totCliente.toFixed(2)} {monedaBase}</span></div>
    </footer>
  );
}
