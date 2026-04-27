import { Fragment } from 'react';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { eq, asc } from 'drizzle-orm';
import { buttonVariants } from '@/components/ui/button';
import { db } from '@/db/client';
import { presupuesto, itemPresupuesto, rubro } from '@/db/schema';
import { getObraByToken } from '@/lib/auth/cliente-token';
import { D } from '@/lib/money/decimal';

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

  return (
    <article>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold">Presupuesto #{p.numero}</h2>
          <p className="text-sm text-muted-foreground">
            Tipo: {p.tipo} · Firmado: {p.fechaFirma?.toLocaleDateString('es-AR')}
          </p>
        </div>
        <a href={`/api/pdf/${p.id}?token=${token}`} className={buttonVariants()}>
          Descargar PDF
        </a>
      </div>

      {p.descripcion && <p className="mb-6">{p.descripcion}</p>}

      <table className="w-full text-sm border">
        <thead className="bg-slate-50">
          <tr>
            <th className="text-left p-2">Descripción</th>
            <th className="text-left p-2 w-20">Cant.</th>
            <th className="text-left p-2 w-16">Un.</th>
            <th className="text-right p-2 w-32">Precio U. ({obra.monedaBase})</th>
            <th className="text-right p-2 w-32">Subtotal</th>
          </tr>
        </thead>
        <tbody>
          {Object.values(grupos).map((g) => (
            <Fragment key={g.nombre}>
              <tr className="bg-slate-100">
                <td colSpan={5} className="p-2 font-semibold">
                  {g.nombre}
                </td>
              </tr>
              {g.items.map(({ item }) => (
                <tr key={item.id} className="border-t">
                  <td className="p-2">{item.descripcion}</td>
                  <td className="p-2">{item.cantidad}</td>
                  <td className="p-2">{item.unidad}</td>
                  <td className="p-2 text-right">{D(item.precioUnitarioCliente).toFixed(2)}</td>
                  <td className="p-2 text-right">
                    {D(item.precioUnitarioCliente).times(item.cantidad).toFixed(2)}
                  </td>
                </tr>
              ))}
              <tr className="border-t font-medium">
                <td colSpan={4} className="p-2 text-right">
                  Subtotal {g.nombre}
                </td>
                <td className="p-2 text-right">{g.subtotal.toFixed(2)}</td>
              </tr>
            </Fragment>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t-2 font-semibold text-lg">
            <td colSpan={4} className="p-2 text-right">
              Total
            </td>
            <td className="p-2 text-right">
              {D(p.totalClienteCalculado ?? '0').toFixed(2)} {obra.monedaBase}
            </td>
          </tr>
        </tfoot>
      </table>

      <Link href={`/cliente/${token}`} className="text-sm underline mt-6 inline-block">
        ← Volver
      </Link>
    </article>
  );
}
