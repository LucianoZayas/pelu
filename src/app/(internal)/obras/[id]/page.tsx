import { notFound } from 'next/navigation';
import Link from 'next/link';
import { buttonVariants } from '@/components/ui/button';
import { Upload } from 'lucide-react';
import { requireSession } from '@/lib/auth/require';
import { getObra } from '@/features/obras/queries';
import { ObraSummary } from '@/features/obras/components/obra-summary';
import { RegenerarTokenButton } from '@/features/obras/components/regenerar-token-button';
import { listarPresupuestosDeObra } from '@/features/presupuestos/queries';

export default async function ObraDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireSession();
  const obra = await getObra(id);
  if (!obra) notFound();
  const previewUrl = `/cliente/${obra.clienteToken}`;
  const presupuestos = await listarPresupuestosDeObra(id);

  return (
    <div>
      <ObraSummary obra={obra} />
      <div className="flex gap-2 mb-6">
        <a href={`/api/export/obras/${id}`} className={buttonVariants({ variant: 'outline' })}>Exportar XLSX</a>
        {user.rol === 'admin' && (
          <>
            <Link href={`/obras/${id}/editar`} className={buttonVariants()}>Editar</Link>
            <Link href={`/obras/${id}/presupuestos/nuevo`} className={buttonVariants({ variant: 'outline' })}>Nuevo presupuesto</Link>
            <Link href={`/obras/${id}/importar`} className={buttonVariants({ variant: 'outline' })}>
              <Upload className="mr-2 h-4 w-4" />
              Importar presupuesto desde Excel
            </Link>
            <RegenerarTokenButton obraId={obra.id} currentToken={obra.clienteToken} />
            <a href={previewUrl} target="_blank" rel="noopener noreferrer" className={buttonVariants({ variant: 'outline' })}>Previsualizar como cliente</a>
          </>
        )}
      </div>
      <section className="border rounded p-4">
        <h2 className="font-semibold mb-2">Presupuestos</h2>
        {presupuestos.length === 0 ? (
          <p className="text-muted-foreground text-sm">No hay presupuestos. Creá el original.</p>
        ) : (
          <ul className="space-y-1">
            {presupuestos.map((p) => (
              <li key={p.id}>
                <Link href={`/obras/${id}/presupuestos/${p.id}`} className="hover:underline">
                  #{p.numero} · {p.tipo} · <span className="text-xs">{p.estado}</span>
                  {p.descripcion ? ` · ${p.descripcion}` : ''}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
