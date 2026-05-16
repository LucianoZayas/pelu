import Link from 'next/link';
import { Plus } from 'lucide-react';
import { requireSession } from '@/lib/auth/require';
import { listarMovimientos, contarMovimientos, type ListarMovimientosFiltros } from '@/features/movimientos/queries';
import { listarObras } from '@/features/obras/queries';
import { listarCuentasConSaldo, listarCuentasActivas } from '@/features/cuentas/queries';
import { listarConceptosActivos } from '@/features/conceptos-movimiento/queries';
import { listarPartesActivas } from '@/features/partes/queries';
import { MovimientosTabla } from '@/features/movimientos/components/movimientos-tabla';
import { MovimientosFiltros } from '@/features/movimientos/components/movimientos-filtros';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type SearchParamsRaw = Promise<Record<string, string | string[] | undefined>>;

function asString(v: string | string[] | undefined): string | undefined {
  if (Array.isArray(v)) return v[0];
  return v;
}

function formatMoney(value: string, moneda: 'USD' | 'ARS'): string {
  const n = Number(value);
  const formatted = new Intl.NumberFormat('es-AR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(n);
  return `${moneda === 'USD' ? 'US$' : '$'} ${formatted}`;
}

export default async function Page({ searchParams }: { searchParams: SearchParamsRaw }) {
  const user = await requireSession();
  const params = await searchParams;

  const filtros: ListarMovimientosFiltros = {
    obraId: asString(params.obra),
    cuentaId: asString(params.cuenta),
    conceptoId: asString(params.concepto),
    parteId: asString(params.parte),
    tipo: asString(params.tipo) as 'entrada' | 'salida' | 'transferencia' | undefined,
    estado: asString(params.estado) as 'previsto' | 'confirmado' | 'anulado' | undefined,
    desde: asString(params.desde),
    hasta: asString(params.hasta),
    search: asString(params.search),
    limit: 100,
  };

  const [rows, total, obras, cuentasConSaldo, cuentas, conceptos, partes] = await Promise.all([
    listarMovimientos(filtros),
    contarMovimientos(filtros),
    listarObras(),
    listarCuentasConSaldo(),
    listarCuentasActivas(),
    listarConceptosActivos(),
    listarPartesActivas(),
  ]);

  return (
    <div className="px-8 py-7 max-w-[1400px]">
      <PageHeader
        kicker="Flujo de caja"
        title="Movimientos"
        description="Ingresos, egresos y transferencias de caja."
        actions={
          <Link href="/movimientos/nuevo">
            <Button size="sm" className="gap-1.5">
              <Plus className="size-4" aria-hidden />
              Nuevo movimiento
            </Button>
          </Link>
        }
      />

      {/* Saldos por cuenta */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {cuentasConSaldo.filter((c) => c.activo).map((c) => {
          const saldoNum = Number(c.saldoActual);
          const isNeg = saldoNum < 0;
          return (
            <div
              key={c.id}
              className="rounded-xl border bg-card px-4 py-3 shadow-[0_1px_2px_rgba(16,24,40,0.04),0_1px_3px_rgba(16,24,40,0.06)]"
            >
              <div className="text-[11px] text-muted-foreground uppercase tracking-[0.06em]">
                {c.nombre}
              </div>
              <div className={cn(
                'mt-1 text-[18px] font-semibold font-mono tabular-nums',
                isNeg && 'text-red-600',
              )}>
                {formatMoney(c.saldoActual, c.moneda)}
              </div>
              <div className="text-[10.5px] text-muted-foreground/70 mt-0.5 capitalize">
                {c.tipo} · {c.moneda}
              </div>
            </div>
          );
        })}
      </div>

      <div className="space-y-4">
        <MovimientosFiltros
          obras={obras.map((o) => ({ id: o.id, label: `${o.codigo} · ${o.nombre}` }))}
          cuentas={cuentas.map((c) => ({ id: c.id, label: `${c.nombre} (${c.moneda})` }))}
          conceptos={conceptos.map((c) => ({ id: c.id, label: c.nombre }))}
          partes={partes.map((p) => ({ id: p.id, label: `${p.nombre} (${p.tipo})` }))}
        />
        <MovimientosTabla
          rows={rows}
          total={total}
          esAdmin={user.rol === 'admin'}
          userId={user.id}
        />
      </div>
    </div>
  );
}
