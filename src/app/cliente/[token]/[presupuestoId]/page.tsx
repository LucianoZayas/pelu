import { Fragment } from 'react';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { eq, asc } from 'drizzle-orm';
import { buttonVariants } from '@/components/ui/button';
import { db } from '@/db/client';
import { presupuesto, itemPresupuesto, rubro } from '@/db/schema';
import { getObraByToken } from '@/lib/auth/cliente-token';
import { D } from '@/lib/money/decimal';
import { cn } from '@/lib/utils';
import { Download, ArrowLeft, CheckCircle2, Circle, TrendingUp } from 'lucide-react';

export default async function PresupuestoClientePage({
  params,
}: {
  params: Promise<{ token: string; presupuestoId: string }>;
}) {
  const { token, presupuestoId } = await params;
  const obra = (await getObraByToken(token))!;

  const [p] = await db
    .select()
    .from(presupuesto)
    .where(eq(presupuesto.id, presupuestoId))
    .limit(1);
  if (!p || p.obraId !== obra.id || p.estado !== 'firmado') notFound();

  const items = await db
    .select({ item: itemPresupuesto, rubro })
    .from(itemPresupuesto)
    .leftJoin(rubro, eq(itemPresupuesto.rubroId, rubro.id))
    .where(eq(itemPresupuesto.presupuestoId, p.id))
    .orderBy(asc(itemPresupuesto.orden));

  // Agrupar por rubro, calculando subtotal y % avance ponderado por monto del item.
  const grupos: Record<
    string,
    { nombre: string; items: typeof items; subtotal: ReturnType<typeof D>; avanceMonto: ReturnType<typeof D> }
  > = {};
  for (const row of items) {
    const k = row.rubro?.nombre ?? 'Sin rubro';
    grupos[k] ??= { nombre: k, items: [], subtotal: D(0), avanceMonto: D(0) };
    const subtotalItem = D(row.item.precioUnitarioCliente).times(row.item.cantidad);
    const avanceItem = subtotalItem.times(D(row.item.porcentajeAvance)).div(100);
    grupos[k].items.push(row);
    grupos[k].subtotal = grupos[k].subtotal.plus(subtotalItem);
    grupos[k].avanceMonto = grupos[k].avanceMonto.plus(avanceItem);
  }

  // Totales: subtotal de items + honorarios + total general + ejecutado.
  const subtotalItems = items.reduce(
    (sum, row) => sum.plus(D(row.item.precioUnitarioCliente).times(row.item.cantidad)),
    D(0),
  );
  const totalHonorarios = items.reduce((sum, row) => {
    const subtotalItem = D(row.item.precioUnitarioCliente).times(row.item.cantidad);
    const porcentaje = D(row.item.porcentajeHonorarios ?? obra.porcentajeHonorarios);
    return sum.plus(subtotalItem.times(porcentaje).div(100));
  }, D(0));
  const totalCliente = subtotalItems.plus(totalHonorarios);
  const totalEjecutado = items.reduce((sum, row) => {
    const subtotalItem = D(row.item.precioUnitarioCliente).times(row.item.cantidad);
    return sum.plus(subtotalItem.times(D(row.item.porcentajeAvance)).div(100));
  }, D(0));
  const progresoGlobalNum = Number(subtotalItems) > 0
    ? Number(totalEjecutado) / Number(subtotalItems) * 100
    : 0;

  return (
    <article>
      {/* Header card */}
      <div className="mb-6 flex items-start justify-between gap-4 rounded-xl border bg-white px-5 py-4 shadow-[0_1px_2px_rgba(16,24,40,0.04),0_1px_3px_rgba(16,24,40,0.06)]">
        <div>
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.1em] text-muted-foreground/70 mb-1">
            Presupuesto #{p.numero} · {p.tipo}
          </p>
          <h2 className="text-[22px] font-semibold tracking-tight text-foreground">
            {p.descripcion ?? (p.tipo === 'original' ? 'Presupuesto original' : 'Presupuesto adicional')}
          </h2>
          <p className="mt-1 text-[13px] text-muted-foreground">
            Firmado el{' '}
            {p.fechaFirma?.toLocaleDateString('es-AR', {
              day: '2-digit',
              month: 'long',
              year: 'numeric',
            })}
          </p>
        </div>
        <a
          href={`/api/pdf/${p.id}?token=${token}`}
          className={buttonVariants({ size: 'sm' })}
        >
          <Download className="size-3.5" />
          Descargar PDF
        </a>
      </div>

      {/* Banner de avance de obra */}
      {progresoGlobalNum > 0 && (
        <div className="mb-6 rounded-xl border bg-gradient-to-br from-primary/5 to-white px-5 py-4 shadow-[0_1px_2px_rgba(16,24,40,0.04),0_1px_3px_rgba(16,24,40,0.06)]">
          <div className="flex items-end justify-between gap-4 mb-3">
            <div>
              <p className="text-[10.5px] font-semibold uppercase tracking-[0.1em] text-muted-foreground/70 mb-1 flex items-center gap-1.5">
                <TrendingUp className="size-3" aria-hidden />
                Avance actual de la obra
              </p>
              <div className="flex items-baseline gap-2">
                <span className="text-[32px] font-bold leading-none tabular-nums">
                  {progresoGlobalNum.toFixed(1)}
                </span>
                <span className="text-[16px] text-muted-foreground font-semibold">%</span>
              </div>
            </div>
            {progresoGlobalNum >= 100 && (
              <div className="flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1.5 text-[12px] font-semibold text-emerald-800">
                <CheckCircle2 className="size-4" aria-hidden />
                Obra completada
              </div>
            )}
          </div>
          <div className="h-2.5 rounded-full bg-secondary overflow-hidden">
            <div
              className={cn(
                'h-full transition-all duration-500 ease-out rounded-full',
                progresoGlobalNum >= 100
                  ? 'bg-gradient-to-r from-emerald-400 to-emerald-500'
                  : 'bg-gradient-to-r from-primary/70 to-primary',
              )}
              style={{ width: `${Math.min(100, progresoGlobalNum)}%` }}
            />
          </div>
        </div>
      )}

      {/* Items table */}
      <div className="rounded-xl border bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04),0_1px_3px_rgba(16,24,40,0.06)] overflow-hidden mb-6">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b bg-[#F8F9FB]">
              <th className="text-left px-4 py-2.5 text-[10.5px] font-semibold uppercase tracking-[0.1em] text-muted-foreground/70 w-8" />
              <th className="text-left px-4 py-2.5 text-[10.5px] font-semibold uppercase tracking-[0.1em] text-muted-foreground/70">
                Descripción
              </th>
              <th className="text-left px-4 py-2.5 text-[10.5px] font-semibold uppercase tracking-[0.1em] text-muted-foreground/70 w-20">
                Cant.
              </th>
              <th className="text-left px-4 py-2.5 text-[10.5px] font-semibold uppercase tracking-[0.1em] text-muted-foreground/70 w-16">
                Un.
              </th>
              <th className="text-right px-4 py-2.5 text-[10.5px] font-semibold uppercase tracking-[0.1em] text-muted-foreground/70 w-32">
                P. Unit. ({obra.monedaBase})
              </th>
              <th className="text-right px-4 py-2.5 text-[10.5px] font-semibold uppercase tracking-[0.1em] text-muted-foreground/70 w-36">
                Subtotal
              </th>
              <th className="text-center px-4 py-2.5 text-[10.5px] font-semibold uppercase tracking-[0.1em] text-muted-foreground/70 w-36">
                Avance
              </th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {Object.values(grupos).map((g) => {
              const progresoRubro = Number(g.subtotal) > 0
                ? Number(g.avanceMonto) / Number(g.subtotal) * 100
                : 0;
              return (
                <Fragment key={g.nombre}>
                  {/* Rubro header */}
                  <tr className="bg-secondary/50">
                    <td className="px-4 py-2" />
                    <td colSpan={5} className="px-4 py-2 text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">
                      {g.nombre}
                    </td>
                    <td className="px-4 py-2 text-right text-[11.5px] font-mono text-muted-foreground tabular-nums">
                      {progresoRubro.toFixed(0)}%
                    </td>
                  </tr>
                  {g.items.map(({ item }) => {
                    const pct = Math.min(100, Math.max(0, Number(item.porcentajeAvance)));
                    const completo = pct >= 100;
                    const empezado = pct > 0;
                    return (
                      <tr key={item.id} className={cn(
                        'hover:bg-secondary/20 transition-colors',
                        completo && 'bg-emerald-50/30',
                      )}>
                        <td className="px-4 py-2.5">
                          {completo ? (
                            <CheckCircle2 className="size-4 text-emerald-500" aria-hidden />
                          ) : empezado ? (
                            <Circle className="size-4 text-blue-500" strokeWidth={2.5} aria-hidden />
                          ) : (
                            <Circle className="size-4 text-muted-foreground/30" aria-hidden />
                          )}
                        </td>
                        <td className={cn('px-4 py-2.5', completo && 'text-muted-foreground')}>{item.descripcion}</td>
                        <td className="px-4 py-2.5 font-mono text-muted-foreground">{item.cantidad}</td>
                        <td className="px-4 py-2.5 text-muted-foreground">{item.unidad}</td>
                        <td className="px-4 py-2.5 text-right font-mono">
                          {D(item.precioUnitarioCliente).toFixed(2)}
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono">
                          {D(item.precioUnitarioCliente).times(item.cantidad).toFixed(2)}
                        </td>
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-1.5 rounded-full bg-secondary overflow-hidden">
                              <div
                                className={cn(
                                  'h-full transition-all duration-300',
                                  completo ? 'bg-emerald-500' : 'bg-primary',
                                )}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <span className="text-[11px] font-mono tabular-nums text-muted-foreground w-9 text-right">
                              {pct.toFixed(0)}%
                            </span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {/* Subtotal row */}
                  <tr className="bg-secondary/30 border-t">
                    <td className="px-4 py-2" />
                    <td colSpan={4} className="px-4 py-2 text-right text-[12px] font-semibold text-muted-foreground">
                      Subtotal {g.nombre}
                    </td>
                    <td className="px-4 py-2 text-right font-mono font-semibold">
                      {g.subtotal.toFixed(2)}
                    </td>
                    <td className="px-4 py-2" />
                  </tr>
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Desglose: subtotal + honorarios + total */}
      <div className="mb-8 flex justify-end">
        <div className="rounded-xl border bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04),0_1px_3px_rgba(16,24,40,0.06)] overflow-hidden min-w-[340px]">
          <div className="px-6 py-3 flex justify-between border-b text-[13px]">
            <span className="text-muted-foreground">Subtotal items</span>
            <span className="font-mono">{subtotalItems.toFixed(2)} {obra.monedaBase}</span>
          </div>
          <div className="px-6 py-3 flex justify-between border-b text-[13px]">
            <span className="text-muted-foreground">Honorarios profesionales</span>
            <span className="font-mono">{totalHonorarios.toFixed(2)} {obra.monedaBase}</span>
          </div>
          <div className="px-6 py-4 flex justify-between items-baseline bg-secondary/30">
            <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground/70">
              Total {obra.monedaBase}
            </span>
            <span className="font-mono text-[24px] font-bold tracking-tight text-foreground">
              {totalCliente.toFixed(2)}
            </span>
          </div>
        </div>
      </div>

      {/* PDF CTA */}
      <div className="flex justify-center mb-4">
        <a
          href={`/api/pdf/${p.id}?token=${token}`}
          className={buttonVariants()}
        >
          <Download className="size-4" />
          Descargar PDF
        </a>
      </div>

      <div className="flex justify-center">
        <Link
          href={`/cliente/${token}`}
          className="inline-flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="size-4" />
          Volver a presupuestos
        </Link>
      </div>
    </article>
  );
}
