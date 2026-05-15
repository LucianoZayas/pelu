import Link from 'next/link';
import { ArrowDownToLine, ArrowUpFromLine, ArrowLeftRight, ChevronRight } from 'lucide-react';
import { formatMoney, formatRelativeTime } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { ActividadItem } from '../queries';

const TIPO_META = {
  entrada: { Icon: ArrowDownToLine, tone: 'text-emerald-700 bg-emerald-50' },
  salida: { Icon: ArrowUpFromLine, tone: 'text-red-700 bg-red-50' },
  transferencia: { Icon: ArrowLeftRight, tone: 'text-blue-700 bg-blue-50' },
};

const TIPO_PREFIX = {
  entrada: '+',
  salida: '−',
  transferencia: '',
};

export function ActividadReciente({ items }: { items: ActividadItem[] }) {
  return (
    <div className="rounded-xl border bg-card overflow-hidden shadow-[0_1px_2px_rgba(16,24,40,0.04),0_1px_3px_rgba(16,24,40,0.06)]">
      <div className="px-5 py-3 border-b bg-muted/30 flex items-center justify-between">
        <div>
          <h3 className="text-[13px] font-semibold">Actividad reciente</h3>
          <p className="text-[11px] text-muted-foreground">Últimos {items.length} movimientos</p>
        </div>
        <Link
          href="/movimientos"
          className="text-[12px] text-primary hover:underline inline-flex items-center gap-1"
        >
          Ver todos
          <ChevronRight className="size-3" aria-hidden />
        </Link>
      </div>
      {items.length === 0 ? (
        <div className="px-6 py-12 text-center text-[13px] text-muted-foreground">
          Sin movimientos todavía.{' '}
          <Link href="/movimientos/nuevo" className="text-primary hover:underline">
            Cargar el primero
          </Link>.
        </div>
      ) : (
        <ul className="divide-y">
          {items.map((m) => {
            const { Icon, tone } = TIPO_META[m.tipo];
            const detalle = m.obraCodigo
              ? `${m.obraCodigo} · ${m.obraNombre}`
              : m.parteOrigenNombre || m.parteDestinoNombre || (m.tipo === 'transferencia' ? `${m.cuentaNombre} → ${m.cuentaDestinoNombre}` : 'Sin parte');
            return (
              <li key={m.id} className="px-5 py-2.5 hover:bg-secondary/30 transition-colors">
                <div className="flex items-center gap-3">
                  <span className={cn('flex size-7 items-center justify-center rounded-md shrink-0', tone)}>
                    <Icon className="size-3.5" aria-hidden />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 text-[13px]">
                      <span className="font-medium">{m.conceptoNombre ?? '—'}</span>
                      {m.conceptoCodigo && (
                        <span className="font-mono text-[10px] text-muted-foreground">{m.conceptoCodigo}</span>
                      )}
                    </div>
                    <div className="text-[12px] text-muted-foreground truncate">{detalle}</div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className={cn('text-[13.5px] font-mono tabular-nums font-medium',
                      m.tipo === 'entrada' && 'text-emerald-700',
                      m.tipo === 'salida' && 'text-red-700',
                    )}>
                      {TIPO_PREFIX[m.tipo]}{formatMoney(m.monto, m.moneda)}
                    </div>
                    <div className="text-[10.5px] text-muted-foreground">
                      {formatRelativeTime(m.fecha)}
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
