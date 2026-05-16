import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { requireSession } from '@/lib/auth/require';
import { db } from '@/db/client';
import { presupuesto } from '@/db/schema';
import { and, eq, isNull } from 'drizzle-orm';
import { getObra } from '@/features/obras/queries';
import { listarCertificacionesDeObra } from '@/features/certificaciones/queries';
import { CertificacionesTabla } from '@/features/certificaciones/components/certificaciones-tabla';
import { NuevaCertDialog } from '@/features/certificaciones/components/nueva-cert-dialog';
import { PageHeader } from '@/components/page-header';

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  await requireSession();
  const { id } = await params;

  const obra = await getObra(id);
  if (!obra) notFound();

  const [certificaciones, presupuestosFirmados] = await Promise.all([
    listarCertificacionesDeObra(id),
    db
      .select({ id: presupuesto.id, numero: presupuesto.numero, tipo: presupuesto.tipo })
      .from(presupuesto)
      .where(and(eq(presupuesto.obraId, id), eq(presupuesto.estado, 'firmado'), isNull(presupuesto.deletedAt)))
      .orderBy(presupuesto.numero),
  ]);

  return (
    <div className="px-8 py-7 max-w-[1400px]">
      <Link
        href={`/obras/${id}`}
        className="inline-flex items-center gap-1.5 text-[12.5px] text-muted-foreground hover:text-foreground mb-3 transition-colors"
      >
        <ArrowLeft className="size-3.5" aria-hidden />
        Volver a la obra
      </Link>
      <PageHeader
        kicker={`OBRA · ${obra.codigo}`}
        title="Certificaciones de avance"
        description="Registrá avances mensuales del presupuesto firmado. Al marcar cobrada, se generan automáticamente 2 movimientos: cobro neto + honorarios."
        actions={<NuevaCertDialog obraId={id} presupuestos={presupuestosFirmados} />}
      />
      <CertificacionesTabla
        obraId={id}
        rows={certificaciones.map((c) => ({
          id: c.id,
          numero: c.numero,
          fecha: c.fecha,
          estado: c.estado,
          totalNeto: c.totalNeto,
          totalHonorarios: c.totalHonorarios,
          totalGeneral: c.totalGeneral,
          moneda: c.moneda,
          presupuestoNumero: c.presupuestoNumero,
          fechaCobro: c.fechaCobro,
        }))}
      />
    </div>
  );
}
