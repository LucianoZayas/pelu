import { requireRole } from '@/lib/auth/require';
import { ObraForm } from '@/features/obras/components/obra-form';
import { crearObra } from '@/features/obras/actions';

export default async function NuevaObraPage() {
  await requireRole('admin');
  return (
    <div>
      <h1 className="text-2xl font-semibold mb-6">Nueva obra</h1>
      <ObraForm onSubmit={crearObra} />
    </div>
  );
}
