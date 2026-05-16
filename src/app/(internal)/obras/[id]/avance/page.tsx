import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, FileText } from 'lucide-react';
import { requireRole } from '@/lib/auth/require';
import { obtenerAvanceDeObra } from '@/features/avance-obra/queries';
import { AvanceEditor } from '@/features/avance-obra/components/avance-editor';
import { PageHeader } from '@/components/page-header';

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  await requireRole('admin');
  const { id } = await params;

  const data = await obtenerAvanceDeObra(id);

  if (!data) {
    return (
      <div className="px-8 py-7 max-w-[1200px]">
        <Link
          href={`/obras/${id}`}
          className="inline-flex items-center gap-1.5 text-[12.5px] text-muted-foreground hover:text-foreground mb-3 transition-colors"
        >
          <ArrowLeft className="size-3.5" aria-hidden />
          Volver a la obra
        </Link>
        <PageHeader
          kicker="Avance"
          title="Avance de obra"
          description="Marcá el progreso de cada item conforme se va completando."
        />
        <div className="rounded-xl border bg-card px-6 py-16 text-center shadow-[0_1px_2px_rgba(16,24,40,0.04),0_1px_3px_rgba(16,24,40,0.06)]">
          <FileText className="size-10 mx-auto text-muted-foreground/40 mb-3" aria-hidden />
          <p className="text-[14px] font-medium">Sin presupuesto firmado</p>
          <p className="mt-1 text-[13px] text-muted-foreground">
            Firmá el presupuesto original de la obra para empezar a registrar avances.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="px-8 py-7 max-w-[1200px]">
      <Link
        href={`/obras/${data.obraId}`}
        className="inline-flex items-center gap-1.5 text-[12.5px] text-muted-foreground hover:text-foreground mb-3 transition-colors"
      >
        <ArrowLeft className="size-3.5" aria-hidden />
        Volver a la obra
      </Link>
      <PageHeader
        kicker={`OBRA · ${data.obraCodigo}`}
        title="Avance de obra"
        description={`Presupuesto #${data.presupuestoNumero} firmado. Marcá el progreso de cada item — los cambios se guardan automáticamente.`}
      />
      <AvanceEditor data={data} />
    </div>
  );
}
