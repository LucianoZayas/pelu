import { requireRole } from '@/lib/auth/require';
import { listarPartes } from '@/features/partes/queries';
import { PartesManager } from '@/features/partes/components/partes-manager';
import { PageHeader } from '@/components/page-header';

export default async function Page() {
  await requireRole('admin');
  const partes = await listarPartes();
  return (
    <div className="px-8 py-7 max-w-[1200px]">
      <PageHeader
        kicker="Configuración"
        title="Partes"
        description="Empresas, socios, empleados, proveedores y terceros que participan de los movimientos de caja."
      />
      <PartesManager partes={partes} />
    </div>
  );
}
