import { TrendingUp, TrendingDown, Scale, ArrowUpDown } from 'lucide-react';
import { formatMoney, formatDelta } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { Kpis } from '../queries';

type Props = {
  actual: Kpis;
  anterior: Kpis;
  moneda: 'USD' | 'ARS';
};

function delta(actual: number, anterior: number): number {
  if (anterior === 0) return actual === 0 ? 0 : 1;
  return (actual - anterior) / Math.abs(anterior);
}

function pickByMoneda(kpis: Kpis, moneda: 'USD' | 'ARS') {
  if (moneda === 'USD') {
    return {
      ingresos: Number(kpis.ingresosUsd),
      egresos: Number(kpis.egresosUsd),
      balance: Number(kpis.balanceNetoUsd),
    };
  }
  return {
    ingresos: Number(kpis.ingresosArs),
    egresos: Number(kpis.egresosArs),
    balance: Number(kpis.balanceNetoArs),
  };
}

export function KpisRow({ actual, anterior, moneda }: Props) {
  const a = pickByMoneda(actual, moneda);
  const p = pickByMoneda(anterior, moneda);

  const ingDelta = delta(a.ingresos, p.ingresos);
  const egDelta = delta(a.egresos, p.egresos);
  const balDelta = delta(a.balance, p.balance);

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <Card
        label="Ingresos"
        icon={TrendingUp}
        iconTone="text-emerald-600 bg-emerald-50"
        value={formatMoney(a.ingresos, moneda)}
        delta={ingDelta}
        invertColors={false}
      />
      <Card
        label="Egresos"
        icon={TrendingDown}
        iconTone="text-red-600 bg-red-50"
        value={formatMoney(a.egresos, moneda)}
        delta={egDelta}
        invertColors  // bajar gastos es positivo
      />
      <Card
        label="Balance neto"
        icon={Scale}
        iconTone={a.balance >= 0 ? 'text-emerald-600 bg-emerald-50' : 'text-red-600 bg-red-50'}
        value={formatMoney(a.balance, moneda)}
        delta={balDelta}
        invertColors={false}
        valueTone={a.balance < 0 ? 'text-red-600' : undefined}
      />
      <Card
        label="vs período anterior"
        icon={ArrowUpDown}
        iconTone="text-muted-foreground bg-secondary"
        value={formatMoney(p.balance, moneda)}
        subtitle="Balance del período anterior"
        delta={null}
        invertColors={false}
      />
    </div>
  );
}

function Card({
  label,
  icon: Icon,
  iconTone,
  value,
  valueTone,
  delta,
  subtitle,
  invertColors,
}: {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  iconTone: string;
  value: string;
  valueTone?: string;
  delta: number | null;
  subtitle?: string;
  invertColors: boolean;
}) {
  const d = delta != null ? formatDelta(delta) : null;
  const deltaPositiveColor = invertColors ? !d?.positive : d?.positive;
  return (
    <div className="rounded-xl border bg-card px-4 py-3.5 shadow-[0_1px_2px_rgba(16,24,40,0.04),0_1px_3px_rgba(16,24,40,0.06)]">
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <span className="text-[11px] text-muted-foreground uppercase tracking-[0.06em] font-medium">
          {label}
        </span>
        <span className={cn('flex size-7 items-center justify-center rounded-md', iconTone)}>
          <Icon className="size-3.5" />
        </span>
      </div>
      <div className={cn('text-[19px] font-semibold font-mono tabular-nums', valueTone)}>
        {value}
      </div>
      {d && !d.zero && (
        <div className={cn(
          'mt-1 text-[11px] font-medium tabular-nums',
          deltaPositiveColor ? 'text-emerald-700' : 'text-red-600',
        )}>
          {d.text} <span className="text-muted-foreground font-normal">vs anterior</span>
        </div>
      )}
      {d?.zero && (
        <div className="mt-1 text-[11px] text-muted-foreground tabular-nums">
          Sin cambio vs anterior
        </div>
      )}
      {subtitle && !d && (
        <div className="mt-1 text-[11px] text-muted-foreground">{subtitle}</div>
      )}
    </div>
  );
}
