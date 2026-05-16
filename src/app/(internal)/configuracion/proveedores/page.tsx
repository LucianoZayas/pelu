import { requireRole } from '@/lib/auth/require';
import { listarProveedores } from '@/features/proveedores/queries';
import { ProveedoresManager } from '@/features/proveedores/components/proveedores-manager';
import { PageHeader } from '@/components/page-header';

export default async function Page() {
  await requireRole('admin');
  const proveedores = await listarProveedores();
  return (
    <div className="px-8 py-7 max-w-[1080px]">
      <PageHeader
        kicker="Configuración"
        title="Proveedores"
        description="Empresas y contratistas con los que Macna trabaja. Necesario para movimientos con concepto que requiere proveedor."
      />
      <ProveedoresManager
        proveedores={proveedores.map((p) => ({
          id: p.id,
          nombre: p.nombre,
          cuit: p.cuit,
          contacto: p.contacto,
          esContratista: p.esContratista,
          activo: p.activo,
        }))}
      />
    </div>
  );
}
