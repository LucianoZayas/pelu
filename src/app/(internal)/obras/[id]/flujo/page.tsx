import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Plus } from 'lucide-react';
import { requireSession } from '@/lib/auth/require';
import { getObra } from '@/features/obras/queries';
import { listarMovimientos, contarMovimientos, type ListarMovimientosFiltros } from '@/features/movimientos/queries';
import { MovimientosTabla } from '@/features/movimientos/components/movimientos-tabla';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type SearchParamsRaw = Promise<Record<string, string | string[] | undefined>>;

function asString(v: string | string[] | undefined): string | undefined {
  if (Array.isArray(v)) return v[0];
  return v;
}

function formatMoney(value: number, moneda: 'USD' | 'ARS'): string {
  const formatted = new Intl.NumberFormat('es-AR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
  return `${moneda === 'USD' ? 'US$' : '$'} ${formatted}`;
}

type ResumenObra = {
  totalIngresosArs: number;
  totalEgresosArs: number;
  totalIngresosUsd: number;
  totalEgresosUsd: number;
};

function resumir(rows: Awaited<ReturnType<typeof listarMovimientos>>): ResumenObra {
  const out: ResumenObra = {
    totalIngresosArs: 0,
    totalEgresosArs: 0,
    totalIngresosUsd: 0,
    totalEgresosUsd: 0,
  };
  for (const r of rows) {
    if (r.estado !== 'confirmado') continue;
    const monto = Number(r.monto);
    if (r.moneda === 'USD') {
      if (r.tipo === 'entrada') out.totalIngresosUsd += monto;
      else if (r.tipo === 'salida') out.totalEgresosUsd += monto;
    } else {
      if (r.tipo === 'entrada') out.totalIngresosArs += monto;
      else if (r.tipo === 'salida') out.totalEgresosArs += monto;
    }
  }
  return out;
}

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: SearchParamsRaw;
}) {
  const user = await requireSession();
  const { id } = await params;
  const sp = await searchParams;

  const obra = await getObra(id);
  if (!obra) notFound();

  const filtros: ListarMovimientosFiltros = {
    obraId: id,
    estado: asString(sp.estado) as 'previsto' | 'confirmado' | 'anulado' | undefined,
    tipo: asString(sp.tipo) as 'entrada' | 'salida' | 'transferencia' | undefined,
    desde: asString(sp.desde),
    hasta: asString(sp.hasta),
    limit: 500,
  };

  const [rows, total, todosRows] = await Promise.all([
    listarMovimientos(filtros),
    contarMovimientos(filtros),
    listarMovimientos({ obraId: id, limit: 1000 }),
  ]);

  const resumen = resumir(todosRows);
  const saldoArs = resumen.totalIngresosArs - resumen.totalEgresosArs;
  const saldoUsd = resumen.totalIngresosUsd - resumen.totalEgresosUsd;

  return (
    <div className="px-8 py-7 max-w-[1400px]">
      <Link
        href={`/obras/${id}`}
        className="inline-flex items-center gap-1.5 text-[12.5px] text-muted-foreground hover:text-foreground mb-3 transition-colors"
      >
        <ArrowLeft className="size-3.5" aria-hidden />
        Volver a la obra
      </Link>
      <PageHeader
        kicker={`Obra ${obra.codigo}`}
        title={`Flujo de caja · ${obra.nombre}`}
        description="Movimientos de ingreso, egreso y transferencias asociados a esta obra."
        actions={
          <Link href={`/movimientos/nuevo?obra=${id}`}>
            <Button size="sm" className="gap-1.5">
              <Plus className="size-4" aria-hidden />
              Nuevo movimiento
            </Button>
          </Link>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <ResumenCard label="Ingresos USD" value={formatMoney(resumen.totalIngresosUsd, 'USD')} tone="positive" />
        <ResumenCard label="Egresos USD"  value={formatMoney(resumen.totalEgresosUsd, 'USD')}  tone="negative" />
        <ResumenCard label="Ingresos ARS" value={formatMoney(resumen.totalIngresosArs, 'ARS')} tone="positive" />
        <ResumenCard label="Egresos ARS"  value={formatMoney(resumen.totalEgresosArs, 'ARS')}  tone="negative" />
        <ResumenCard
          label="Saldo neto USD"
          value={formatMoney(saldoUsd, 'USD')}
          tone={saldoUsd >= 0 ? 'neutral' : 'negative'}
        />
        <ResumenCard
          label="Saldo neto ARS"
          value={formatMoney(saldoArs, 'ARS')}
          tone={saldoArs >= 0 ? 'neutral' : 'negative'}
        />
      </div>

      <MovimientosTabla rows={rows} total={total} esAdmin={user.rol === 'admin'} />
    </div>
  );
}

function ResumenCard({
  label, value, tone,
}: { label: string; value: string; tone: 'positive' | 'negative' | 'neutral' }) {
  return (
    <div className="rounded-xl border bg-card px-4 py-3 shadow-[0_1px_2px_rgba(16,24,40,0.04),0_1px_3px_rgba(16,24,40,0.06)]">
      <div className="text-[11px] text-muted-foreground uppercase tracking-[0.06em]">
        {label}
      </div>
      <div className={cn(
        'mt-1 text-[16px] font-semibold font-mono tabular-nums',
        tone === 'positive' && 'text-emerald-700',
        tone === 'negative' && 'text-red-600',
      )}>
        {value}
      </div>
    </div>
  );
}
