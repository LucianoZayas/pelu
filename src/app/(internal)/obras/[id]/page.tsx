import { notFound } from 'next/navigation';
import Link from 'next/link';
import { buttonVariants } from '@/components/ui/button';
import { requireSession } from '@/lib/auth/require';
import { getObra } from '@/features/obras/queries';
import { ObraSummary } from '@/features/obras/components/obra-summary';

export default async function ObraDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireSession();
  const obra = await getObra(id);
  if (!obra) notFound();
  const previewUrl = `/cliente/${obra.clienteToken}`;

  return (
    <div>
      <ObraSummary obra={obra} />
      <div className="flex gap-2 mb-6">
        {user.rol === 'admin' && (
          <>
            <Link href={`/obras/${id}/editar`} className={buttonVariants()}>Editar</Link>
            <Link href={`/obras/${id}/presupuestos/nuevo`} className={buttonVariants({ variant: 'outline' })}>Nuevo presupuesto</Link>
            <a href={previewUrl} target="_blank" rel="noopener noreferrer" className={buttonVariants({ variant: 'outline' })}>Previsualizar como cliente</a>
          </>
        )}
      </div>
      <section className="border rounded p-4">
        <h2 className="font-semibold mb-2">Presupuestos</h2>
        <p className="text-muted-foreground text-sm">(Lista de presupuestos llega en Plan 3.)</p>
      </section>
    </div>
  );
}
