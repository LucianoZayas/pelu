import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Pencil, ArrowLeft } from 'lucide-react';
import { requireSession } from '@/lib/auth/require';
import { buttonVariants } from '@/components/ui/button';
import { obtenerMovimientoDetallado } from '@/features/movimientos/queries';
import { listarAuditDeEntidad } from '@/features/audit/queries';
import { MovimientoDetail } from '@/features/movimientos/components/movimiento-detail';
import { PageHeader } from '@/components/page-header';

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireSession();
  const { id } = await params;

  const [mov, auditEntries] = await Promise.all([
    obtenerMovimientoDetallado(id),
    listarAuditDeEntidad('movimiento', id),
  ]);

  if (!mov) notFound();

  const puedeEditar = mov.estado !== 'anulado' && (user.rol === 'admin' || mov.createdBy === user.id);

  return (
    <div className="px-8 py-7 max-w-[1280px]">
      <Link
        href="/movimientos"
        className="inline-flex items-center gap-1.5 text-[12.5px] text-muted-foreground hover:text-foreground mb-3 transition-colors"
      >
        <ArrowLeft className="size-3.5" aria-hidden />
        Volver a movimientos
      </Link>
      <PageHeader
        kicker="Flujo de caja · Detalle"
        title={mov.conceptoNombre ?? 'Movimiento'}
        description={`${mov.cuentaNombre ?? 'Sin cuenta'} · ${mov.tipo === 'transferencia' ? 'Transferencia entre cuentas' : mov.tipo === 'entrada' ? 'Ingreso' : 'Egreso'}`}
        actions={
          puedeEditar ? (
            <Link
              href={`/movimientos/${id}/editar`}
              className={buttonVariants({ size: 'sm' })}
            >
              <Pencil className="size-3.5" />
              Editar
            </Link>
          ) : null
        }
      />
      <MovimientoDetail mov={mov} auditEntries={auditEntries} />
    </div>
  );
}
