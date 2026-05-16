import Link from 'next/link';
import { Plus } from 'lucide-react';
import { requireSession } from '@/lib/auth/require';
import {
  obtenerKpisDelPeriodo,
  obtenerSaldosConDetalle,
  obtenerFlujoPorDia,
  obtenerBreakdownPorConcepto,
  obtenerActividadReciente,
  obtenerAlertas,
  obtenerTopObras,
} from '@/features/flujo-caja/queries';
import { PeriodoSelector } from '@/features/flujo-caja/components/periodo-selector';
import { KpisRow } from '@/features/flujo-caja/components/kpis-row';
import { SaldosCuentasDetalle } from '@/features/flujo-caja/components/saldos-cuentas-detalle';
import { GraficoFlujo } from '@/features/flujo-caja/components/grafico-flujo';
import { BreakdownConceptos } from '@/features/flujo-caja/components/breakdown-conceptos';
import { ActividadReciente } from '@/features/flujo-caja/components/actividad-reciente';
import { AlertasPanel } from '@/features/flujo-caja/components/alertas-panel';
import { TopObras } from '@/features/flujo-caja/components/top-obras';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { rangoDelPreset } from '@/lib/format';

type SearchParamsRaw = Promise<Record<string, string | string[] | undefined>>;

function asString(v: string | string[] | undefined): string | undefined {
  if (Array.isArray(v)) return v[0];
  return v;
}

// Período anterior de la misma duración para comparar KPIs.
function rangoAnterior(desde: string, hasta: string): { desde: string; hasta: string } {
  const d = new Date(desde);
  const h = new Date(hasta);
  const dias = Math.round((h.getTime() - d.getTime()) / 86400000) + 1;
  const dAnt = new Date(d);
  dAnt.setDate(dAnt.getDate() - dias);
  const hAnt = new Date(d);
  hAnt.setDate(hAnt.getDate() - 1);
  return { desde: dAnt.toISOString().slice(0, 10), hasta: hAnt.toISOString().slice(0, 10) };
}

export default async function Page({ searchParams }: { searchParams: SearchParamsRaw }) {
  await requireSession();
  const sp = await searchParams;

  const presetMes = rangoDelPreset('mes');
  const desde = asString(sp.desde) ?? presetMes.desde;
  const hasta = asString(sp.hasta) ?? presetMes.hasta;
  const anterior = rangoAnterior(desde, hasta);

  const [kpis, kpisAnt, saldos, flujoDia, breakdown, actividad, alertas, topObras] = await Promise.all([
    obtenerKpisDelPeriodo(desde, hasta),
    obtenerKpisDelPeriodo(anterior.desde, anterior.hasta),
    obtenerSaldosConDetalle(desde, hasta),
    obtenerFlujoPorDia(desde, hasta),
    obtenerBreakdownPorConcepto(desde, hasta, 5),
    obtenerActividadReciente(10),
    obtenerAlertas(desde, hasta),
    obtenerTopObras(desde, hasta, 5),
  ]);

  return (
    <div className="px-8 py-7 max-w-[1400px]">
      <PageHeader
        kicker="Flujo de caja"
        title="Dashboard"
        description="Vista panorámica de la caja: KPIs del período, gráfico de flujo, breakdown por concepto, alertas y actividad reciente."
        actions={
          <Link href="/movimientos/nuevo">
            <Button size="sm" className="gap-1.5">
              <Plus className="size-4" aria-hidden />
              Nuevo movimiento
            </Button>
          </Link>
        }
      />

      <div className="mb-5">
        <PeriodoSelector desde={desde} hasta={hasta} />
      </div>

      <div className="grid gap-5">
        <KpisRow actual={kpis} anterior={kpisAnt} moneda="ARS" />

        {alertas.length > 0 && (
          <section className="grid gap-2">
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground/85">
              Alertas
            </h2>
            <AlertasPanel alertas={alertas} />
          </section>
        )}

        <section className="grid gap-2">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground/85">
            Saldos por cuenta
          </h2>
          <SaldosCuentasDetalle cuentas={saldos} />
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          <div className="lg:col-span-2">
            <GraficoFlujo datos={flujoDia} />
          </div>
          <div>
            <BreakdownConceptos conceptos={breakdown} />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <ActividadReciente items={actividad} />
          <TopObras obras={topObras} />
        </div>
      </div>
    </div>
  );
}
