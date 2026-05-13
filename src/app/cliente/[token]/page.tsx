import Link from 'next/link';
import { buttonVariants } from '@/components/ui/button';
import { and, eq, isNull } from 'drizzle-orm';
import { getObraByToken } from '@/lib/auth/cliente-token';
import { db } from '@/db/client';
import { presupuesto } from '@/db/schema';
import { FileText, ArrowRight } from 'lucide-react';

export default async function ClientePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const obra = (await getObraByToken(token))!;

  const presupuestosFirmados = await db
    .select()
    .from(presupuesto)
    .where(
      and(
        eq(presupuesto.obraId, obra.id),
        eq(presupuesto.estado, 'firmado'),
        isNull(presupuesto.deletedAt),
      ),
    );

  if (presupuestosFirmados.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <FileText className="mb-4 size-10 text-muted-foreground/30" aria-hidden />
        <p className="text-[15px] font-medium text-foreground">Sin presupuestos disponibles</p>
        <p className="mt-1 text-[13.5px] text-muted-foreground">
          Aún no hay presupuestos firmados para esta obra.
        </p>
      </div>
    );
  }

  return (
    <div>
      <h2 className="mb-5 text-[14px] font-semibold text-foreground">
        Presupuestos firmados
        <span className="ml-2 font-mono text-[12px] text-muted-foreground">
          ({presupuestosFirmados.length})
        </span>
      </h2>
      <div className="grid gap-3">
        {presupuestosFirmados.map((p) => (
          <div
            key={p.id}
            className="flex items-center justify-between gap-4 rounded-xl border bg-white px-5 py-4 shadow-[0_1px_2px_rgba(16,24,40,0.04),0_1px_3px_rgba(16,24,40,0.06)]"
          >
            <div className="flex items-center gap-4">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-[#F8F9FB]">
                <FileText className="size-5 text-muted-foreground/60" aria-hidden />
              </div>
              <div>
                <p className="text-[14px] font-semibold text-foreground">
                  Presupuesto #{p.numero}{' '}
                  <span className="text-[12px] font-medium text-muted-foreground capitalize">
                    ({p.tipo})
                  </span>
                </p>
                <p className="mt-0.5 text-[12px] text-muted-foreground">
                  Firmado el{' '}
                  {p.fechaFirma?.toLocaleDateString('es-AR', {
                    day: '2-digit',
                    month: 'long',
                    year: 'numeric',
                  })}
                  {p.totalClienteCalculado
                    ? ` · Total: ${parseFloat(p.totalClienteCalculado).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${obra.monedaBase}`
                    : ''}
                </p>
              </div>
            </div>
            <Link
              href={`/cliente/${token}/${p.id}`}
              className={buttonVariants({ variant: 'outline', size: 'sm' })}
            >
              Ver detalle
              <ArrowRight className="size-3.5" />
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}
