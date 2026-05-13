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
    <footer className="sticky bottom-0 z-10 border-t bg-card/95 backdrop-blur-sm px-6 py-3.5 flex items-center justify-end gap-8 shadow-[0_-1px_0_rgba(16,24,40,0.06)]">
      <div className="flex items-baseline gap-1.5">
        <span className="text-[12px] text-muted-foreground uppercase tracking-wide font-medium">Costo</span>
        <span className="font-mono text-[15px] font-semibold text-foreground">
          {totCosto.toFixed(2)}
        </span>
        <span className="text-[12px] text-muted-foreground">{monedaBase}</span>
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className="text-[12px] text-muted-foreground uppercase tracking-wide font-medium">Cliente</span>
        <span className="font-mono text-[18px] font-bold text-primary">
          {totCliente.toFixed(2)}
        </span>
        <span className="text-[13px] font-medium text-muted-foreground">{monedaBase}</span>
      </div>
    </footer>
  );
}
