import { requireRole } from '@/lib/auth/require';
import { listarUsuarios } from '@/features/usuarios/queries';
import { UsuariosTable } from '@/features/usuarios/components/usuarios-table';
import { InvitarDialog } from '@/features/usuarios/components/invitar-dialog';
import { PageHeader } from '@/components/page-header';

export default async function Page() {
  await requireRole('admin');
  const usuarios = await listarUsuarios();
  return (
    <div className="px-8 py-7 max-w-[1080px]">
      <PageHeader
        kicker="Configuración"
        title="Usuarios"
        description="Administrá quién accede a la app y con qué rol (admin o operador)."
        actions={<InvitarDialog />}
      />
      <UsuariosTable usuarios={usuarios} />
    </div>
  );
}
