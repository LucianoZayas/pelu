import { notFound } from 'next/navigation';
import { requireSession } from '@/lib/auth/require';
import { getPresupuesto, getItemsConRubros } from '@/features/presupuestos/queries';
import { listarRubrosPlanos } from '@/features/rubros/queries';
import { EditorForm } from '@/features/presupuestos/components/editor-form';

type ItemForm = {
  id?: string;
  rubroId: string;
  orden: number;
  descripcion: string;
  unidad: string;
  cantidad: string;
  costoUnitario: string;
  costoUnitarioMoneda: 'USD' | 'ARS';
  markupPorcentaje: string | null;
  notas: string | null;
};

type Grupo = { rubroId: string; rubroNombre: string; items: ItemForm[] };

export default async function EditorPage({ params }: { params: Promise<{ id: string; presId: string }> }) {
  const { id, presId } = await params;
  const user = await requireSession();
  if (user.rol !== 'admin') {
    throw new Response('Forbidden', { status: 403 });
  }

  const p = await getPresupuesto(presId);
  if (!p || p.obraId !== id) notFound();

  const [items, rubros] = await Promise.all([
    getItemsConRubros(presId),
    listarRubrosPlanos(),
  ]);

  // Agrupar items por rubro, asegurando un grupo por cada rubro activo (aunque vacío) para que se pueda agregar.
  const gruposMap = new Map<string, Grupo>();
  for (const r of rubros.filter((r) => r.activo)) {
    gruposMap.set(r.id, { rubroId: r.id, rubroNombre: r.nombre, items: [] });
  }
  for (const { item } of items) {
    const g = gruposMap.get(item.rubroId);
    if (g) g.items.push({
      id: item.id, rubroId: item.rubroId, orden: item.orden,
      descripcion: item.descripcion, unidad: item.unidad, cantidad: item.cantidad,
      costoUnitario: item.costoUnitario, costoUnitarioMoneda: item.costoUnitarioMoneda,
      markupPorcentaje: item.markupPorcentaje, notas: item.notas,
    });
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-2">{p.obra.codigo} · Presupuesto #{p.numero} ({p.tipo})</h1>
      <p className="text-sm text-muted-foreground mb-6">Estado: <strong>{p.estado}</strong></p>
      <EditorForm
        presupuestoId={p.id}
        initialVersion={p.version}
        initialDescripcion={p.descripcion}
        initialMarkupDefault={p.markupDefaultPorcentaje}
        initialCotizacion={p.cotizacionUsd}
        initialEstado={p.estado}
        monedaBase={p.obra.monedaBase}
        rubros={rubros.filter((r) => r.activo).map((r) => ({ id: r.id, nombre: r.nombre }))}
        initialGrupos={Array.from(gruposMap.values())}
      />
    </div>
  );
}
