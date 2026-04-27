import Link from 'next/link';
import { and, eq, isNull } from 'drizzle-orm';
import { getObraByToken } from '@/lib/auth/cliente-token';
import { db } from '@/db/client';
import { presupuesto } from '@/db/schema';

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
      <p className="text-muted-foreground">Aún no hay presupuestos firmados disponibles.</p>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="font-semibold">Presupuestos firmados</h2>
      <ul className="space-y-2">
        {presupuestosFirmados.map((p) => (
          <li key={p.id} className="border rounded p-4 flex items-center justify-between">
            <div>
              <div className="font-medium">
                Presupuesto #{p.numero} ({p.tipo})
              </div>
              <div className="text-xs text-muted-foreground">
                Firmado el {p.fechaFirma?.toLocaleDateString('es-AR')} · Total:{' '}
                {p.totalClienteCalculado} {obra.monedaBase}
              </div>
            </div>
            <Link href={`/cliente/${token}/${p.id}`} className="text-sm underline">
              Ver detalle
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
