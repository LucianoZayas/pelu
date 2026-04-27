import { requireRole } from '@/lib/auth/require';
import { buscarLogs, type BuscarFiltros } from '@/features/audit/queries';
import { AuditoriaTable } from '@/features/audit/components/auditoria-table';
import { AuditoriaFiltros } from '@/features/audit/components/auditoria-filtros';

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireRole('admin');
  const sp = await searchParams;
  const rows = await buscarLogs({
    entidad: (sp.entidad as BuscarFiltros['entidad']) || undefined,
    accion: (sp.accion as BuscarFiltros['accion']) || undefined,
    desde: sp.desde ? new Date(sp.desde) : undefined,
    hasta: sp.hasta ? new Date(sp.hasta + 'T23:59:59') : undefined,
    limit: 200,
  });
  return (
    <div>
      <h1 className="text-2xl font-semibold mb-6">Auditoría</h1>
      <AuditoriaFiltros />
      <AuditoriaTable rows={rows} />
    </div>
  );
}
