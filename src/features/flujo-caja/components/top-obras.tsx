import Link from 'next/link';
import { Building2, ChevronRight } from 'lucide-react';
import { formatMoney } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { ObraConActividad } from '../queries';

export function TopObras({ obras }: { obras: ObraConActividad[] }) {
  if (obras.length === 0) {
    return (
      <div className="rounded-xl border bg-card p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04),0_1px_3px_rgba(16,24,40,0.06)] h-full">
        <h3 className="text-[13px] font-semibold mb-1">Top obras</h3>
        <p className="text-[11px] text-muted-foreground mb-4">Con más movimientos del período</p>
        <div className="text-center text-[13px] text-muted-foreground py-12">
          Sin movimientos asignados a obras en el período.
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border bg-card overflow-hidden shadow-[0_1px_2px_rgba(16,24,40,0.04),0_1px_3px_rgba(16,24,40,0.06)] h-full flex flex-col">
      <div className="px-5 py-3 border-b">
        <h3 className="text-[13px] font-semibold">Top obras</h3>
        <p className="text-[11px] text-muted-foreground">Con más movimientos del período</p>
      </div>
      <ul className="divide-y flex-1">
        {obras.map((o) => {
          const netoArs = Number(o.totalIngresosArs) - Number(o.totalEgresosArs);
          const netoUsd = Number(o.totalIngresosUsd) - Number(o.totalEgresosUsd);
          const tieneArs = Number(o.totalIngresosArs) + Number(o.totalEgresosArs) > 0;
          const tieneUsd = Number(o.totalIngresosUsd) + Number(o.totalEgresosUsd) > 0;
          return (
            <li key={o.obraId}>
              <Link
                href={`/obras/${o.obraId}/flujo`}
                className="flex items-center gap-3 px-5 py-2.5 hover:bg-secondary/30 transition-colors group"
              >
                <Building2 className="size-3.5 text-muted-foreground/60 shrink-0" aria-hidden />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 text-[13px]">
                    <span className="font-medium truncate">{o.nombre}</span>
                    <span className="font-mono text-[10px] text-muted-foreground">{o.codigo}</span>
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    {o.cantidadMovimientos} movimiento{o.cantidadMovimientos === 1 ? '' : 's'}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  {tieneArs && (
                    <div className={cn(
                      'text-[12px] font-mono tabular-nums',
                      netoArs >= 0 ? 'text-emerald-700' : 'text-red-600',
                    )}>
                      {formatMoney(netoArs, 'ARS', { minDecimals: 0, maxDecimals: 0 })}
                    </div>
                  )}
                  {tieneUsd && (
                    <div className={cn(
                      'text-[12px] font-mono tabular-nums',
                      netoUsd >= 0 ? 'text-emerald-700' : 'text-red-600',
                    )}>
                      {formatMoney(netoUsd, 'USD', { minDecimals: 0, maxDecimals: 0 })}
                    </div>
                  )}
                  {!tieneArs && !tieneUsd && (
                    <span className="text-[12px] text-muted-foreground">—</span>
                  )}
                </div>
                <ChevronRight className="size-3.5 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors shrink-0" aria-hidden />
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
