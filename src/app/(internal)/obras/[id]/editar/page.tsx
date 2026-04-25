import { notFound } from 'next/navigation';
import { requireRole } from '@/lib/auth/require';
import { getObra } from '@/features/obras/queries';
import { ObraForm } from '@/features/obras/components/obra-form';
import { editarObra } from '@/features/obras/actions';
import type { ObraInput } from '@/features/obras/schema';

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
    <div>
      <h1 className="text-2xl font-semibold mb-6">Editar {obra.codigo}</h1>
      <ObraForm initial={initial} onSubmit={onSubmit} />
    </div>
  );
}
