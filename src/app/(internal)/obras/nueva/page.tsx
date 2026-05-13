import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { requireRole } from '@/lib/auth/require';
import { ObraForm } from '@/features/obras/components/obra-form';
import { crearObra } from '@/features/obras/actions';
import { PageHeader } from '@/components/page-header';

export default async function NuevaObraPage() {
  await requireRole('admin');
  return (
    <div className="px-8 py-7 max-w-[920px]">
      <Link
        href="/obras"
        className="inline-flex items-center gap-1 text-[12.5px] text-muted-foreground hover:text-foreground transition-colors mb-3"
      >
        <ArrowLeft className="size-3.5" /> Obras
      </Link>
      <PageHeader
        kicker="Crear"
        title="Nueva obra"
        description="Completá los datos básicos. Después podrás crear presupuestos asociados o importar uno desde Excel."
      />
      <div className="rounded-xl border bg-card p-6 shadow-[0_1px_2px_rgba(16,24,40,0.04),0_1px_3px_rgba(16,24,40,0.06)]">
        <ObraForm onSubmit={crearObra} />
      </div>
    </div>
  );
}
