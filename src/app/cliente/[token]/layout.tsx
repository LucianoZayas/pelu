import { notFound } from 'next/navigation';
import { getObraByToken } from '@/lib/auth/cliente-token';

function MacnaLogoSmall() {
  return (
    <div className="flex items-center gap-2">
      <svg width="18" height="18" viewBox="0 0 22 22" fill="none" aria-hidden="true">
        <rect x="2" y="7" width="6" height="13" rx="0.5" fill="#3B5BFE" />
        <rect x="10" y="2" width="6" height="18" rx="0.5" fill="rgba(59,91,254,0.85)" />
        <rect x="18" y="11" width="2" height="9" rx="0.5" fill="rgba(59,91,254,0.65)" />
      </svg>
      <span className="font-semibold text-[14px] tracking-tight text-foreground">Macna</span>
    </div>
  );
}

export default async function ClienteLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const obra = await getObraByToken(token);
  if (!obra) notFound(); // proxy ya redirigió, esto es defensa.

  return (
    <div className="min-h-screen bg-[#F8F9FB]">
      {/* Header */}
      <header className="border-b bg-white shadow-[0_1px_0_rgba(16,24,40,0.05)]">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-5">
            <MacnaLogoSmall />
            <div className="h-5 w-px bg-border" aria-hidden />
            <div>
              <h1 className="text-[15px] font-semibold text-foreground leading-tight">
                {obra.nombre}
              </h1>
              <p className="text-[12px] text-muted-foreground">
                {obra.codigo} · {obra.clienteNombre}
              </p>
            </div>
          </div>
          <span className="text-[11px] text-muted-foreground/60 hidden sm:block">
            Presupuestos
          </span>
        </div>
      </header>
      <main className="max-w-4xl mx-auto px-6 py-8">{children}</main>
      <footer className="border-t bg-white mt-12">
        <div className="max-w-4xl mx-auto px-6 py-4 text-center text-[11.5px] text-muted-foreground">
          Macna · Sistema de gestión de obras
        </div>
      </footer>
    </div>
  );
}
