import { Fragment } from 'react';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { eq, asc } from 'drizzle-orm';
import { buttonVariants } from '@/components/ui/button';
import { db } from '@/db/client';
import { presupuesto, itemPresupuesto, rubro } from '@/db/schema';
import { getObraByToken } from '@/lib/auth/cliente-token';
import { D } from '@/lib/money/decimal';
import { Download, ArrowLeft } from 'lucide-react';

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

  // Agrupar por rubro.
  const grupos: Record<
    string,
    { nombre: string; items: typeof items; subtotal: ReturnType<typeof D> }
  > = {};
  for (const row of items) {
    const k = row.rubro?.nombre ?? 'Sin rubro';
    grupos[k] ??= { nombre: k, items: [], subtotal: D(0) };
    grupos[k].items.push(row);
    grupos[k].subtotal = grupos[k].subtotal.plus(
      D(row.item.precioUnitarioCliente).times(row.item.cantidad),
    );
  }

  // Subtotal de items (sin honorarios). El totalClienteCalculado del presupuesto
  // se mantiene como referencia pero acá lo recalculamos para el desglose.
  const subtotalItems = items.reduce(
    (sum, row) => sum.plus(D(row.item.precioUnitarioCliente).times(row.item.cantidad)),
    D(0),
  );
  // Honorarios profesionales: cada item puede tener override (porcentajeHonorarios)
  // o usa el default de la obra (porcentajeHonorarios). Sumamos por item.
  const totalHonorarios = items.reduce((sum, row) => {
    const subtotalItem = D(row.item.precioUnitarioCliente).times(row.item.cantidad);
    const porcentaje = D(row.item.porcentajeHonorarios ?? obra.porcentajeHonorarios);
    return sum.plus(subtotalItem.times(porcentaje).div(100));
  }, D(0));
  const totalCliente = subtotalItems.plus(totalHonorarios);

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

      {/* Items table */}
      <div className="rounded-xl border bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04),0_1px_3px_rgba(16,24,40,0.06)] overflow-hidden mb-6">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b bg-[#F8F9FB]">
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
            </tr>
          </thead>
          <tbody className="divide-y">
            {Object.values(grupos).map((g) => (
              <Fragment key={g.nombre}>
                {/* Rubro header */}
                <tr className="bg-secondary/50">
                  <td colSpan={5} className="px-4 py-2 text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {g.nombre}
                  </td>
                </tr>
                {g.items.map(({ item }) => (
                  <tr key={item.id} className="hover:bg-secondary/20 transition-colors">
                    <td className="px-4 py-2.5 text-foreground">{item.descripcion}</td>
                    <td className="px-4 py-2.5 font-mono text-muted-foreground">{item.cantidad}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{item.unidad}</td>
                    <td className="px-4 py-2.5 text-right font-mono">
                      {D(item.precioUnitarioCliente).toFixed(2)}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono">
                      {D(item.precioUnitarioCliente).times(item.cantidad).toFixed(2)}
                    </td>
                  </tr>
                ))}
                {/* Subtotal row */}
                <tr className="bg-secondary/30 border-t">
                  <td colSpan={4} className="px-4 py-2 text-right text-[12px] font-semibold text-muted-foreground">
                    Subtotal {g.nombre}
                  </td>
                  <td className="px-4 py-2 text-right font-mono font-semibold">
                    {g.subtotal.toFixed(2)}
                  </td>
                </tr>
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>

      {/* Desglose: subtotal + honorarios + total */}
      <div className="mb-8 flex justify-end">
        <div className="rounded-xl border bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04),0_1px_3px_rgba(16,24,40,0.06)] overflow-hidden min-w-[320px]">
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
