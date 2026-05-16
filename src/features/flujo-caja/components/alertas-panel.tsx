import Link from 'next/link';
import { AlertTriangle, Info, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { AlertaDashboard } from '../queries';

export function AlertasPanel({ alertas }: { alertas: AlertaDashboard[] }) {
  if (alertas.length === 0) {
    return (
      <div className="rounded-xl border bg-card p-4 shadow-[0_1px_2px_rgba(16,24,40,0.04),0_1px_3px_rgba(16,24,40,0.06)]">
        <div className="flex items-center gap-2.5 text-[12.5px] text-emerald-700">
          <CheckCircle2 className="size-4 shrink-0" aria-hidden />
          <span>Sin alertas. Cuentas en positivo y sin gastos no recuperables registrados en el período.</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {alertas.map((a, i) => {
        const isWarning = a.severidad === 'warning';
        const Icon = isWarning ? AlertTriangle : Info;
        const Body = a.link ? Link : 'div';
        const bodyProps = a.link ? { href: a.link } : {};
        return (
          <Body
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            {...(bodyProps as any)}
            key={i}
            className={cn(
              'flex items-start gap-3 rounded-xl border px-4 py-3 transition-colors',
              isWarning
                ? 'border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100/70'
                : 'border-blue-200 bg-blue-50/70 text-blue-900 hover:bg-blue-100/60',
              a.link && 'cursor-pointer',
            )}
          >
            <Icon
              className={cn('size-4 shrink-0 mt-0.5', isWarning ? 'text-amber-600' : 'text-blue-600')}
              aria-hidden
            />
            <div className="min-w-0 flex-1">
              <div className="text-[13px] font-medium">{a.titulo}</div>
              <div className="text-[12px] opacity-80 mt-0.5">{a.detalle}</div>
            </div>
          </Body>
        );
      })}
    </div>
  );
}
