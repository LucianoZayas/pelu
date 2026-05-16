import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, AlertCircle } from 'lucide-react';
import { requireRole } from '@/lib/auth/require';
import {
  obtenerCertificacionConPresupuesto,
  listarAvancesDeCertificacion,
} from '@/features/certificaciones/queries';
import { listarCuentasActivas } from '@/features/cuentas/queries';
import { AvanceEditor } from '@/features/certificaciones/components/avance-editor';
import { CertActionsBar } from '@/features/certificaciones/components/cert-actions-bar';
import { PageHeader } from '@/components/page-header';
import { Badge } from '@/components/ui/badge';
import { formatMoney, formatDate, formatRelativeTime } from '@/lib/format';
import { cn } from '@/lib/utils';

const ESTADO_TONE = {
  borrador: 'border-amber-300 bg-amber-50 text-amber-800',
  emitida: 'border-blue-300 bg-blue-50 text-blue-800',
  cobrada: 'border-emerald-300 bg-emerald-50 text-emerald-800',
  anulada: 'border-red-300 bg-red-50 text-red-800',
};

export default async function Page({
  params,
}: {
  params: Promise<{ id: string; certId: string }>;
}) {
  await requireRole('admin'); // Solo admin maneja certificaciones.
  const { id, certId } = await params;

  const detail = await obtenerCertificacionConPresupuesto(certId);
  if (!detail || detail.obra.id !== id) notFound();

  const [avances, cuentas] = await Promise.all([
    listarAvancesDeCertificacion(certId),
    listarCuentasActivas(),
  ]);

  const { cert, presupuesto: pres, obra } = detail;
  const isReadonly = cert.estado !== 'borrador';

  return (
    <div className="px-8 py-7 max-w-[1400px]">
      <Link
        href={`/obras/${id}/certificaciones`}
        className="inline-flex items-center gap-1.5 text-[12.5px] text-muted-foreground hover:text-foreground mb-3 transition-colors"
      >
        <ArrowLeft className="size-3.5" aria-hidden />
        Volver a certificaciones
      </Link>
      <PageHeader
        kicker={`OBRA · ${obra.codigo}`}
        title={`Certificación N° ${cert.numero}`}
        description={cert.descripcion ?? `Presupuesto #${pres.numero}`}
        actions={
          <div className="flex items-center gap-3">
            <Badge variant="outline" className={cn('font-normal capitalize', ESTADO_TONE[cert.estado])}>
              {cert.estado}
            </Badge>
            <CertActionsBar
              certId={cert.id}
              estado={cert.estado}
              totalNeto={cert.totalNeto}
              totalHonorarios={cert.totalHonorarios}
              totalGeneral={cert.totalGeneral}
              moneda={cert.moneda}
              cuentas={cuentas.map((c) => ({ id: c.id, nombre: c.nombre, moneda: c.moneda, tipo: c.tipo }))}
            />
          </div>
        }
      />

      <div className="space-y-5">
        {cert.estado === 'anulada' && cert.anuladoMotivo && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-800 flex items-start gap-2">
            <AlertCircle className="size-4 shrink-0 mt-0.5" aria-hidden />
            <div>
              <div className="font-medium">Anulada</div>
              <div className="opacity-90">{cert.anuladoMotivo}</div>
              {cert.anuladoAt && (
                <div className="opacity-70 text-[11.5px] mt-0.5">{formatRelativeTime(cert.anuladoAt)}</div>
              )}
            </div>
          </div>
        )}

        {cert.estado === 'cobrada' && cert.fechaCobro && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-[13px] text-emerald-800">
            <div className="font-medium">Cobrada el {formatDate(cert.fechaCobro)}</div>
            <div className="text-[11.5px] mt-0.5">
              Total {formatMoney(cert.totalGeneral, cert.moneda)} ·{' '}
              <Link href={`/movimientos?cuenta=&search=N%C2%B0+${cert.numero}`} className="hover:underline">
                Ver movimientos generados
              </Link>
            </div>
          </div>
        )}

        <AvanceEditor
          certId={cert.id}
          moneda={cert.moneda}
          avances={avances}
          readonly={isReadonly}
        />
      </div>
    </div>
  );
}
