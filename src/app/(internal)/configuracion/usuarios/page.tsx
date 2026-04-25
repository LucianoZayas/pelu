import { requireRole } from '@/lib/auth/require';
import { listarUsuarios } from '@/features/usuarios/queries';
import { UsuariosTable } from '@/features/usuarios/components/usuarios-table';
import { InvitarDialog } from '@/features/usuarios/components/invitar-dialog';

export default async function Page() {
  await requireRole('admin');
  const usuarios = await listarUsuarios();
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">Usuarios</h1>
        <InvitarDialog />
      </div>
      <UsuariosTable usuarios={usuarios} />
    </div>
  );
}
