import { requireRole } from '@/lib/auth/require';
import { listarRubrosArbol, listarRubrosPlanos } from '@/features/rubros/queries';
import { RubrosTree } from '@/features/rubros/components/rubros-tree';
import { PageHeader } from '@/components/page-header';

export default async function Page() {
  await requireRole('admin');
  const [arbol, planos] = await Promise.all([listarRubrosArbol(), listarRubrosPlanos()]);
  return (
    <div className="px-8 py-7 max-w-[1080px]">
      <PageHeader
        kicker="Configuración"
        title="Rubros"
        description="Catálogo de rubros utilizables en presupuestos. Se organiza como un árbol jerárquico."
      />
      <div className="rounded-xl border bg-card p-6 shadow-[0_1px_2px_rgba(16,24,40,0.04),0_1px_3px_rgba(16,24,40,0.06)]">
        <RubrosTree arbol={arbol} planos={planos.map((p) => ({ id: p.id, nombre: p.nombre }))} />
      </div>
    </div>
  );
}
