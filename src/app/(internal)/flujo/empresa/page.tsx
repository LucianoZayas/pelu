import Link from 'next/link';
import { Plus } from 'lucide-react';
import { requireSession } from '@/lib/auth/require';
import { listarMovimientos, contarMovimientos, type ListarMovimientosFiltros } from '@/features/movimientos/queries';
import { listarCuentasConSaldo, listarCuentasActivas } from '@/features/cuentas/queries';
import { listarConceptosActivos } from '@/features/conceptos-movimiento/queries';
import { listarPartesActivas } from '@/features/partes/queries';
import { isNull } from 'drizzle-orm';
import { db } from '@/db/client';
import { movimiento } from '@/db/schema';
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

  // Solo movimientos SIN obra asociada (= movimientos de empresa).
  // listarMovimientos no soporta este filtro nativo: hago query manual y paso ids.
  const empresaIds = await db
    .select({ id: movimiento.id })
    .from(movimiento)
    .where(isNull(movimiento.obraId));
  const idsSet = new Set(empresaIds.map((r) => r.id));

  // Reuso filtros pero filtro a mano los ids al final.
  const filtros: ListarMovimientosFiltros = {
    cuentaId: asString(params.cuenta),
    conceptoId: asString(params.concepto),
    parteId: asString(params.parte),
    tipo: asString(params.tipo) as 'entrada' | 'salida' | 'transferencia' | undefined,
    estado: asString(params.estado) as 'previsto' | 'confirmado' | 'anulado' | undefined,
    desde: asString(params.desde),
    hasta: asString(params.hasta),
    search: asString(params.search),
    limit: 500,
  };

  const [allRows, cuentasConSaldo, cuentas, conceptos, partes] = await Promise.all([
    listarMovimientos(filtros),
    listarCuentasConSaldo(),
    listarCuentasActivas(),
    listarConceptosActivos(),
    listarPartesActivas(),
  ]);

  const rows = allRows.filter((r) => idsSet.has(r.id));

  return (
    <div className="px-8 py-7 max-w-[1400px]">
      <PageHeader
        kicker="Flujo de caja"
        title="Caja empresa"
        description="Movimientos sin obra asociada: estructura, sueldos, cobros de socios, gastos varios."
        actions={
          <Link href="/movimientos/nuevo">
            <Button size="sm" className="gap-1.5">
              <Plus className="size-4" aria-hidden />
              Nuevo movimiento
            </Button>
          </Link>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {cuentasConSaldo.filter((c) => c.activo).map((c) => {
          const isNeg = Number(c.saldoActual) < 0;
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
          obras={[]}
          cuentas={cuentas.map((c) => ({ id: c.id, label: `${c.nombre} (${c.moneda})` }))}
          conceptos={conceptos.map((c) => ({ id: c.id, label: c.nombre }))}
          partes={partes.map((p) => ({ id: p.id, label: `${p.nombre} (${p.tipo})` }))}
        />
        <MovimientosTabla rows={rows} total={rows.length} esAdmin={user.rol === 'admin'} />
      </div>
    </div>
  );
}
