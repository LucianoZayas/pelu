import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { requireRole } from '@/lib/auth/require';
import { getObra } from '@/features/obras/queries';
import { ObraForm } from '@/features/obras/components/obra-form';
import { editarObra } from '@/features/obras/actions';
import type { ObraInput } from '@/features/obras/schema';
import { PageHeader } from '@/components/page-header';

export default async function EditarObraPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireRole('admin');
  const obra = await getObra(id);
  if (!obra) notFound();

  async function onSubmit(input: ObraInput) {
    'use server';
    return editarObra(id, input);
  }

  const initial: Partial<ObraInput & { id: string }> = {
    nombre: obra.nombre,
    clienteNombre: obra.clienteNombre,
    clienteEmail: obra.clienteEmail ?? null,
    clienteTelefono: obra.clienteTelefono ?? null,
    ubicacion: obra.ubicacion ?? null,
    superficieM2: obra.superficieM2 ?? null,
    monedaBase: obra.monedaBase,
    cotizacionUsdInicial: obra.cotizacionUsdInicial ?? null,
    porcentajeHonorarios: obra.porcentajeHonorarios,
  };

  return (
    <div className="px-8 py-7 max-w-[920px]">
      <Link
        href={`/obras/${id}`}
        className="inline-flex items-center gap-1 text-[12.5px] text-muted-foreground hover:text-foreground transition-colors mb-3"
      >
        <ArrowLeft className="size-3.5" /> Volver a {obra.codigo}
      </Link>
      <PageHeader
        kicker={`Obra · ${obra.codigo}`}
        title={`Editar ${obra.nombre}`}
        description="Actualizá los metadatos de la obra. Los presupuestos asociados no se ven afectados."
      />
      <div className="rounded-xl border bg-card p-6 shadow-[0_1px_2px_rgba(16,24,40,0.04),0_1px_3px_rgba(16,24,40,0.06)]">
        <ObraForm initial={initial} onSubmit={onSubmit} />
      </div>
    </div>
  );
}
