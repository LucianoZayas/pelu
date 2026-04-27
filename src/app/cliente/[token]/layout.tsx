import { notFound } from 'next/navigation';
import { getObraByToken } from '@/lib/auth/cliente-token';

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
    <div className="min-h-screen bg-white">
      <header className="border-b">
        <div className="max-w-4xl mx-auto p-6 flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Macna · Construcción
            </p>
            <h1 className="text-xl font-semibold">{obra.nombre}</h1>
            <p className="text-sm text-muted-foreground">
              {obra.codigo} · {obra.clienteNombre}
            </p>
          </div>
        </div>
      </header>
      <main className="max-w-4xl mx-auto p-6">{children}</main>
    </div>
  );
}
