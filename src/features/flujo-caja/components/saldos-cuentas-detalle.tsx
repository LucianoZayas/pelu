import { Wallet, Landmark, ArrowDownToLine, ArrowUpFromLine } from 'lucide-react';
import { formatMoney, formatRelativeTime } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { CuentaConDetalle } from '../queries';

export function SaldosCuentasDetalle({ cuentas }: { cuentas: CuentaConDetalle[] }) {
  const activas = cuentas.filter((c) => c.activo);

  if (activas.length === 0) {
    return (
      <div className="rounded-xl border bg-card px-6 py-8 text-center text-[13px] text-muted-foreground">
        Sin cuentas activas. Creá una en{' '}
        <a href="/configuracion/cuentas" className="text-primary hover:underline">/configuracion/cuentas</a>.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
      {activas.map((c) => {
        const Icon = c.tipo === 'banco' ? Landmark : Wallet;
        const saldoNum = Number(c.saldoActual);
        const isNeg = saldoNum < 0;
        return (
          <div
            key={c.id}
            className="rounded-xl border bg-card px-4 py-3.5 shadow-[0_1px_2px_rgba(16,24,40,0.04),0_1px_3px_rgba(16,24,40,0.06)]"
          >
            <div className="flex items-center justify-between gap-2 mb-1">
              <div className="flex items-center gap-1.5 min-w-0">
                <Icon className="size-3.5 text-muted-foreground shrink-0" aria-hidden />
                <span className="text-[13px] font-medium truncate">{c.nombre}</span>
              </div>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-secondary text-muted-foreground">
                {c.moneda}
              </span>
            </div>
            <div className={cn(
              'text-[18px] font-semibold font-mono tabular-nums',
              isNeg ? 'text-red-600' : 'text-foreground',
            )}>
              {formatMoney(c.saldoActual, c.moneda)}
            </div>
            <div className="mt-2 pt-2 border-t flex items-center gap-3 text-[11px]">
              <span className="flex items-center gap-1 text-emerald-700 tabular-nums">
                <ArrowDownToLine className="size-3" aria-hidden />
                {formatMoney(c.ingresoMes, c.moneda, { minDecimals: 0, maxDecimals: 0 })}
              </span>
              <span className="flex items-center gap-1 text-red-600 tabular-nums">
                <ArrowUpFromLine className="size-3" aria-hidden />
                {formatMoney(c.egresoMes, c.moneda, { minDecimals: 0, maxDecimals: 0 })}
              </span>
            </div>
            <div className="mt-1 text-[10.5px] text-muted-foreground">
              {c.ultimoMovimientoFecha
                ? `Último mov: ${formatRelativeTime(c.ultimoMovimientoFecha)}`
                : 'Sin movimientos aún'}
            </div>
          </div>
        );
      })}
    </div>
  );
}
