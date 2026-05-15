import Link from 'next/link';
import { Building2, Layers, Users, History, LogOut, Wallet, ArrowLeftRight, Tags, Contact, LayoutDashboard } from 'lucide-react';
import { requireSession } from '@/lib/auth/require';
import { cerrarSesion } from './sign-out-action';

function MacnaLogo() {
  // Skyline mark: dos rectángulos de distinto alto, en indigo. Discreto, no Lord-of-the-rings.
  return (
    <Link href="/obras" className="group flex items-center gap-2.5 px-3 py-1">
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
        <rect x="2" y="7" width="6" height="13" rx="0.5" className="fill-primary" />
        <rect x="10" y="2" width="6" height="18" rx="0.5" className="fill-primary/85" />
        <rect x="18" y="11" width="2" height="9" rx="0.5" className="fill-primary/65" />
      </svg>
      <span className="font-semibold text-[15px] tracking-tight">Macna</span>
    </Link>
  );
}

interface NavItemProps {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

function NavItem({ href, label, icon: Icon }: NavItemProps) {
  // Note: para "active" exacto necesitaríamos usePathname (client), pero el sidebar es server.
  // Por simplicidad mantengo todos en estado idle visualmente y dependemos del hover.
  // El active state real lo agregamos cuando convirtamos a client component (más adelante).
  return (
    <Link
      href={href}
      className="group flex items-center gap-2.5 rounded-md px-3 py-2 text-[13.5px] font-medium text-sidebar-foreground/85 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
    >
      <Icon className="size-4 text-sidebar-foreground/55 group-hover:text-sidebar-accent-foreground" />
      <span>{label}</span>
    </Link>
  );
}

export default async function InternalLayout({ children }: { children: React.ReactNode }) {
  const user = await requireSession();
  const isAdmin = user.rol === 'admin';

  const initials = user.nombre
    .split(' ')
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <div className="min-h-screen flex bg-background">
      <aside className="w-60 shrink-0 border-r bg-sidebar flex flex-col">
        {/* Logo block */}
        <div className="px-3 pt-5 pb-4 border-b">
          <MacnaLogo />
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-3 flex flex-col gap-0.5">
          <div className="px-3 pb-1.5 pt-1 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-sidebar-foreground/45">
            Principal
          </div>
          <NavItem href="/obras" label="Obras" icon={Building2} />
          <NavItem href="/flujo" label="Flujo de caja" icon={LayoutDashboard} />
          <NavItem href="/movimientos" label="Movimientos" icon={ArrowLeftRight} />

          {isAdmin && (
            <>
              <div className="px-3 pb-1.5 pt-4 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-sidebar-foreground/45">
                Configuración
              </div>
              <NavItem href="/configuracion/rubros" label="Rubros" icon={Layers} />
              <NavItem href="/configuracion/cuentas" label="Cuentas" icon={Wallet} />
              <NavItem href="/configuracion/conceptos" label="Conceptos" icon={Tags} />
              <NavItem href="/configuracion/partes" label="Partes" icon={Contact} />
              <NavItem href="/configuracion/usuarios" label="Usuarios" icon={Users} />
              <NavItem href="/configuracion/auditoria" label="Auditoría" icon={History} />
            </>
          )}
        </nav>

        {/* User card */}
        <div className="border-t px-3 py-3">
          <div className="flex items-center gap-2.5 px-2 py-1.5">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-semibold text-primary">
              {initials || '?'}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[13px] font-medium leading-tight">{user.nombre}</div>
              <div className="text-[11px] text-sidebar-foreground/55 capitalize leading-tight mt-0.5">{user.rol}</div>
            </div>
            <form action={cerrarSesion}>
              <button
                type="submit"
                aria-label="Cerrar sesión"
                title="Cerrar sesión"
                className="flex size-7 items-center justify-center rounded-md text-sidebar-foreground/55 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
              >
                <LogOut className="size-3.5" />
              </button>
            </form>
          </div>
        </div>
      </aside>

      <main className="flex-1 min-w-0">{children}</main>
    </div>
  );
}
