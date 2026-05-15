import { ArrowDownToLine, ArrowUpFromLine, ArrowLeftRight } from 'lucide-react';
import { formatMoney } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { ConceptoBreakdown } from '../queries';

const TIPO_META = {
  ingreso: { Icon: ArrowDownToLine, tone: 'text-emerald-700', bg: 'bg-emerald-500' },
  egreso: { Icon: ArrowUpFromLine, tone: 'text-red-700', bg: 'bg-red-500' },
  transferencia: { Icon: ArrowLeftRight, tone: 'text-blue-700', bg: 'bg-blue-500' },
};

export function BreakdownConceptos({ conceptos }: { conceptos: ConceptoBreakdown[] }) {
  if (conceptos.length === 0) {
    return (
      <div className="rounded-xl border bg-card p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04),0_1px_3px_rgba(16,24,40,0.06)] h-full">
        <h3 className="text-[13px] font-semibold mb-1">Por concepto</h3>
        <p className="text-[11px] text-muted-foreground mb-4">Top 5 del período</p>
        <div className="text-center text-[13px] text-muted-foreground py-12">
          Sin movimientos en el período.
        </div>
      </div>
    );
  }

  // Tomamos el "peso" total (ARS + USD*1000 para tener una métrica unificada visual).
  const pesos = conceptos.map((c) => Number(c.totalArs) + Number(c.totalUsd) * 1000);
  const max = Math.max(...pesos, 1);

  return (
    <div className="rounded-xl border bg-card p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04),0_1px_3px_rgba(16,24,40,0.06)] h-full flex flex-col">
      <div className="mb-3">
        <h3 className="text-[13px] font-semibold">Por concepto</h3>
        <p className="text-[11px] text-muted-foreground">Top 5 del período (volumen total)</p>
      </div>
      <ul className="flex-1 space-y-3">
        {conceptos.map((c, i) => {
          const { Icon, tone, bg } = TIPO_META[c.tipo];
          const peso = pesos[i];
          const pct = (peso / max) * 100;
          const hayArs = Number(c.totalArs) > 0;
          const hayUsd = Number(c.totalUsd) > 0;
          return (
            <li key={c.conceptoId}>
              <div className="flex items-center justify-between gap-2 mb-1">
                <div className="flex items-center gap-1.5 min-w-0 flex-1">
                  <Icon className={cn('size-3 shrink-0', tone)} aria-hidden />
                  <span className="text-[12.5px] font-medium truncate">{c.nombre}</span>
                  <span className="text-[10.5px] text-muted-foreground font-mono shrink-0">
                    {c.cantidad}×
                  </span>
                </div>
                <div className="text-[11.5px] font-mono tabular-nums text-right shrink-0">
                  {hayArs && <div>{formatMoney(c.totalArs, 'ARS', { minDecimals: 0, maxDecimals: 0 })}</div>}
                  {hayUsd && <div className="text-muted-foreground">{formatMoney(c.totalUsd, 'USD', { minDecimals: 0, maxDecimals: 0 })}</div>}
                </div>
              </div>
              <div className="h-1 rounded-full bg-secondary overflow-hidden">
                <div
                  className={cn('h-full rounded-full transition-all', bg)}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
