import { notFound } from 'next/navigation';
import { requireRole } from '@/lib/auth/require';
import { db } from '@/db/client';
import { obra, presupuesto } from '@/db/schema';
import { eq, and, isNull } from 'drizzle-orm';
import { ImportarObraExistenteClient } from './importar-client';

export default async function ImportarObraExistentePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole('admin');
  const { id } = await params;

  const [o] = await db
    .select()
    .from(obra)
    .where(and(eq(obra.id, id), isNull(obra.deletedAt)))
    .limit(1);
  if (!o) notFound();

  const presupuestos = await db
    .select()
    .from(presupuesto)
    .where(and(eq(presupuesto.obraId, id), isNull(presupuesto.deletedAt)));

  const borradorActivo = presupuestos.find(
    (p) => p.estado === 'borrador' && !p.importPendiente,
  );
  const firmadoActivo = presupuestos.find((p) => p.estado === 'firmado');

  let caso: 'sin_presupuesto' | 'reemplazar_borrador' | 'crear_adicional';
  if (firmadoActivo) caso = 'crear_adicional';
  else if (borradorActivo) caso = 'reemplazar_borrador';
  else caso = 'sin_presupuesto';

  return (
    <ImportarObraExistenteClient
      obraId={o.id}
      obraNombre={o.nombre}
      obraCodigo={o.codigo}
      monedaBase={o.monedaBase}
      cotizacionUsdInicial={o.cotizacionUsdInicial ?? '1'}
      markupDefaultPorcentaje={
        firmadoActivo?.markupDefaultPorcentaje ??
        borradorActivo?.markupDefaultPorcentaje ??
        '30'
      }
      porcentajeHonorarios={o.porcentajeHonorarios ?? '16'}
      caso={caso}
    />
  );
}
