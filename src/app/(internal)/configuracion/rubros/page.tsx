import { requireRole } from '@/lib/auth/require';
import { listarRubrosArbol, listarRubrosPlanos } from '@/features/rubros/queries';
import { RubrosTree } from '@/features/rubros/components/rubros-tree';

export default async function Page() {
  await requireRole('admin');
  const [arbol, planos] = await Promise.all([listarRubrosArbol(), listarRubrosPlanos()]);
  return (
    <div>
      <h1 className="text-2xl font-semibold mb-6">Rubros</h1>
      <RubrosTree arbol={arbol} planos={planos.map((p) => ({ id: p.id, nombre: p.nombre }))} />
    </div>
  );
}
