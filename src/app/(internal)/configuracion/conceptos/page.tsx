import { requireRole } from '@/lib/auth/require';
import { listarConceptos } from '@/features/conceptos-movimiento/queries';
import { ConceptosManager } from '@/features/conceptos-movimiento/components/conceptos-manager';
import { PageHeader } from '@/components/page-header';

export default async function Page() {
  await requireRole('admin');
  const conceptos = await listarConceptos();
  return (
    <div className="px-8 py-7 max-w-[1080px]">
      <PageHeader
        kicker="Configuración"
        title="Conceptos de movimiento"
        description="Catálogo de categorías para los movimientos de caja. Cada concepto puede exigir obra, proveedor, o marcarse como gasto no recuperable."
      />
      <ConceptosManager
        conceptos={conceptos.map((c) => ({
          id: c.id,
          codigo: c.codigo,
          nombre: c.nombre,
          tipo: c.tipo,
          requiereObra: c.requiereObra,
          requiereProveedor: c.requiereProveedor,
          esNoRecuperable: c.esNoRecuperable,
          orden: c.orden,
          activo: c.activo,
        }))}
      />
    </div>
  );
}
