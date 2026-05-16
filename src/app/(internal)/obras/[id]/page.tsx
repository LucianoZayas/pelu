import { notFound } from 'next/navigation';
import Link from 'next/link';
import { buttonVariants } from '@/components/ui/button';
import { Edit, Plus, Upload, ExternalLink, Download, ArrowLeftRight, FileText, FileCheck } from 'lucide-react';
import { requireSession } from '@/lib/auth/require';
import { getObra } from '@/features/obras/queries';
import { ObraSummary } from '@/features/obras/components/obra-summary';
import { RegenerarTokenButton } from '@/features/obras/components/regenerar-token-button';
import { listarPresupuestosDeObra } from '@/features/presupuestos/queries';
import { PageHeader } from '@/components/page-header';
import { EstadoBadge } from '@/components/estado-badge';

export default async function ObraDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireSession();
  const obra = await getObra(id);
  if (!obra) notFound();
  const previewUrl = `/cliente/${obra.clienteToken}`;
  const presupuestos = await listarPresupuestosDeObra(id);

  return (
    <div className="px-8 py-7 max-w-[1280px]">
      <PageHeader
        kicker={`OBRA · ${obra.codigo}`}
        title={obra.nombre}
        description={obra.clienteNombre}
        actions={
          <>
            <Link
              href={`/obras/${id}/flujo`}
              className={buttonVariants({ variant: 'outline', size: 'sm' })}
            >
              <ArrowLeftRight className="size-3.5" />
              Flujo de caja
            </Link>
            <Link
              href={`/obras/${id}/certificaciones`}
              className={buttonVariants({ variant: 'outline', size: 'sm' })}
            >
              <FileCheck className="size-3.5" />
              Certificaciones
            </Link>
            <a
              href={`/api/export/obras/${id}`}
              className={buttonVariants({ variant: 'outline', size: 'sm' })}
            >
              <Download className="size-3.5" />
              Exportar XLSX
            </a>
            {user.rol === 'admin' && (
              <>
                <a
                  href={previewUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={buttonVariants({ variant: 'outline', size: 'sm' })}
                >
                  <ExternalLink className="size-3.5" />
                  Vista cliente
                </a>
                <RegenerarTokenButton obraId={obra.id} currentToken={obra.clienteToken} />
                <Link
                  href={`/obras/${id}/importar`}
                  className={buttonVariants({ variant: 'outline', size: 'sm' })}
                >
                  <Upload className="size-3.5" />
                  Importar Excel
                </Link>
                <Link
                  href={`/obras/${id}/presupuestos/nuevo`}
                  className={buttonVariants({ variant: 'outline', size: 'sm' })}
                >
                  <Plus className="size-3.5" />
                  Nuevo presupuesto
                </Link>
                <Link
                  href={`/obras/${id}/editar`}
                  className={buttonVariants({ size: 'sm' })}
                >
                  <Edit className="size-3.5" />
                  Editar
                </Link>
              </>
            )}
          </>
        }
      />

      <ObraSummary obra={obra} />

      {/* Presupuestos section */}
      <section>
        <h2 className="text-[14px] font-semibold text-foreground mb-4">
          Presupuestos
          {presupuestos.length > 0 && (
            <span className="ml-2 font-mono text-[12px] text-muted-foreground">
              ({presupuestos.length})
            </span>
          )}
        </h2>

        {presupuestos.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-12 text-center">
            <FileText className="mb-3 size-8 text-muted-foreground/40" aria-hidden />
            <p className="text-[13.5px] font-medium text-foreground">No hay presupuestos</p>
            <p className="mt-1 text-[13px] text-muted-foreground">
              Creá el presupuesto original para esta obra.
            </p>
            {user.rol === 'admin' && (
              <div className="mt-4 flex gap-2">
                <Link
                  href={`/obras/${id}/presupuestos/nuevo`}
                  className={buttonVariants({ size: 'sm' })}
                >
                  <Plus className="size-3.5" />
                  Nuevo presupuesto
                </Link>
                <Link
                  href={`/obras/${id}/importar`}
                  className={buttonVariants({ variant: 'outline', size: 'sm' })}
                >
                  <Upload className="size-3.5" />
                  Importar desde Excel
                </Link>
              </div>
            )}
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {presupuestos.map((p) => (
              <Link
                key={p.id}
                href={`/obras/${id}/presupuestos/${p.id}`}
                className="group flex flex-col gap-3 rounded-xl border bg-card p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04),0_1px_3px_rgba(16,24,40,0.06)] transition-shadow hover:shadow-[0_1px_4px_rgba(16,24,40,0.06),0_2px_8px_rgba(16,24,40,0.08)]"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[12px] font-semibold text-muted-foreground">
                      #{p.numero}
                    </span>
                    <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] font-medium capitalize text-secondary-foreground">
                      {p.tipo}
                    </span>
                  </div>
                  <EstadoBadge estado={p.estado} />
                </div>
                {p.descripcion && (
                  <p className="text-[13px] text-muted-foreground line-clamp-2">
                    {p.descripcion}
                  </p>
                )}
                {p.fechaFirma && (
                  <p className="text-[11.5px] text-muted-foreground/70">
                    Firmado{' '}
                    {new Intl.DateTimeFormat('es-AR', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                    }).format(p.fechaFirma)}
                  </p>
                )}
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
