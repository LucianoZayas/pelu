import { renderToStream } from '@react-pdf/renderer';
import { eq, asc } from 'drizzle-orm';
import { db } from '@/db/client';
import { presupuesto, itemPresupuesto, obra, rubro } from '@/db/schema';
import { D } from '@/lib/money/decimal';
import { PresupuestoPdfV1, type PdfData } from './template-v1';

export async function buildPdfData(presupuestoId: string): Promise<PdfData | null> {
  const [p] = await db
    .select()
    .from(presupuesto)
    .where(eq(presupuesto.id, presupuestoId))
    .limit(1);
  if (!p) return null;

  const [o] = await db.select().from(obra).where(eq(obra.id, p.obraId));
  if (!o) return null;

  const items = await db
    .select({ item: itemPresupuesto, rubro })
    .from(itemPresupuesto)
    .leftJoin(rubro, eq(itemPresupuesto.rubroId, rubro.id))
    .where(eq(itemPresupuesto.presupuestoId, p.id))
    .orderBy(asc(itemPresupuesto.orden));

  const gruposMap = new Map<
    string,
    {
      nombre: string;
      items: PdfData['grupos'][number]['items'];
      subtotal: ReturnType<typeof D>;
    }
  >();

  for (const { item, rubro: r } of items) {
    const key = r?.nombre ?? 'Sin rubro';
    if (!gruposMap.has(key)) {
      gruposMap.set(key, { nombre: key, items: [], subtotal: D(0) });
    }
    const sub = D(item.precioUnitarioCliente).times(item.cantidad);
    const g = gruposMap.get(key)!;
    g.items.push({
      descripcion: item.descripcion,
      cantidad: D(item.cantidad).toFixed(2),
      unidad: item.unidad,
      precioUnitario: D(item.precioUnitarioCliente).toFixed(2),
      subtotal: sub.toFixed(2),
    });
    g.subtotal = g.subtotal.plus(sub);
  }

  return {
    obra: {
      codigo: o.codigo,
      nombre: o.nombre,
      clienteNombre: o.clienteNombre,
      monedaBase: o.monedaBase,
      ubicacion: o.ubicacion,
    },
    presupuesto: {
      numero: p.numero,
      tipo: p.tipo,
      descripcion: p.descripcion,
      fechaFirma: p.fechaFirma,
      totalClienteCalculado: D(p.totalClienteCalculado ?? '0').toFixed(2),
    },
    grupos: Array.from(gruposMap.values()).map((g) => ({
      nombre: g.nombre,
      items: g.items,
      subtotal: g.subtotal.toFixed(2),
    })),
  };
}

export async function renderPresupuestoPdfStream(
  presupuestoId: string,
): Promise<NodeJS.ReadableStream | null> {
  const [p] = await db
    .select({ templateVersion: presupuesto.templateVersion })
    .from(presupuesto)
    .where(eq(presupuesto.id, presupuestoId))
    .limit(1);
  if (!p) return null;

  const data = await buildPdfData(presupuestoId);
  if (!data) return null;

  switch (p.templateVersion) {
    case 1:
      return renderToStream(<PresupuestoPdfV1 data={data} />);
    default:
      throw new Error(`template_version ${p.templateVersion} no soportada`);
  }
}
