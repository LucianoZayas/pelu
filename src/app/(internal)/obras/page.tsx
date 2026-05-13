import Link from 'next/link';
import { buttonVariants } from '@/components/ui/button';
import { Upload, Plus, Download } from 'lucide-react';
import { listarObras } from '@/features/obras/queries';
import { ObrasTable } from '@/features/obras/components/obras-table';
import { PageHeader } from '@/components/page-header';
import { requireSession } from '@/lib/auth/require';

export default async function ObrasPage() {
  const user = await requireSession();
  const obras = await listarObras();

  const stats = {
    total: obras.length,
    borradores: obras.filter((o) => o.estado === 'borrador').length,
    activas: obras.filter((o) => o.estado === 'activa' || o.estado === 'borrador').length,
  };

  return (
    <div className="px-8 py-7 max-w-[1280px]">
      <PageHeader
        kicker="Gestión"
        title="Obras"
        description="Listado completo de obras y sus presupuestos asociados."
        actions={
          <>
            <a
              href="/api/export/obras"
              className={buttonVariants({ variant: 'outline', size: 'sm' })}
            >
              <Download className="size-3.5" />
              Exportar XLSX
            </a>
            {user.rol === 'admin' && (
              <>
                <Link href="/obras/importar" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
                  <Upload className="size-3.5" />
                  Nueva obra desde Excel
                </Link>
                <Link href="/obras/nueva" className={buttonVariants({ size: 'sm' })}>
                  <Plus className="size-3.5" />
                  Nueva obra
                </Link>
              </>
            )}
          </>
        }
      />

      {obras.length > 0 && (
        <div className="mb-5 flex items-center gap-5 text-[13px] text-muted-foreground">
          <span>
            <strong className="font-mono tabular-nums text-foreground">{stats.total}</strong>{' '}
            {stats.total === 1 ? 'obra' : 'obras'}
          </span>
          {stats.borradores > 0 && (
            <span className="inline-flex items-center gap-1.5">
              <span className="size-1.5 rounded-full bg-amber-500" aria-hidden />
              <strong className="font-mono tabular-nums text-foreground">{stats.borradores}</strong>
              {stats.borradores === 1 ? ' borrador' : ' borradores'}
            </span>
          )}
        </div>
      )}

      <ObrasTable obras={obras} />
    </div>
  );
}
