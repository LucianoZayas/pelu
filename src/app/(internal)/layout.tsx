import Link from 'next/link';
import { requireSession } from '@/lib/auth/require';
import { Button } from '@/components/ui/button';
import { cerrarSesion } from './sign-out-action';

export default async function InternalLayout({ children }: { children: React.ReactNode }) {
  const user = await requireSession();
  const isAdmin = user.rol === 'admin';
  return (
    <div className="min-h-screen flex">
      <aside className="w-56 border-r bg-slate-50 p-4 flex flex-col gap-1">
        <div className="font-bold mb-4">Macna</div>
        <Link href="/obras" className="px-2 py-1 rounded hover:bg-slate-200">Obras</Link>
        {isAdmin && (
          <>
            <Link href="/configuracion/rubros" className="px-2 py-1 rounded hover:bg-slate-200">Rubros</Link>
            <Link href="/configuracion/usuarios" className="px-2 py-1 rounded hover:bg-slate-200">Usuarios</Link>
            <Link href="/configuracion/auditoria" className="px-2 py-1 rounded hover:bg-slate-200">Auditoría</Link>
          </>
        )}
        <div className="mt-auto text-xs text-muted-foreground">
          <div className="mb-2">{user.nombre} ({user.rol})</div>
          <form action={cerrarSesion}>
            <Button variant="ghost" size="sm" type="submit">Salir</Button>
          </form>
        </div>
      </aside>
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
