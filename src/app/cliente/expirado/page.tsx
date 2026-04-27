export const dynamic = 'force-static';

export default function ExpiradoPage() {
  return (
    <div className="min-h-screen grid place-items-center bg-slate-50">
      <div className="max-w-md text-center p-6 bg-white border rounded">
        <h1 className="text-2xl font-semibold mb-3">El enlace expiró</h1>
        <p className="text-muted-foreground mb-4">
          Este link de acceso fue regenerado o ya no es válido. Por favor, contactá a la
          administración de Macna para recibir el enlace actualizado.
        </p>
        <p className="text-sm text-muted-foreground">
          📞 +54 11 0000-0000 · ✉ admin@macna.com.ar
        </p>
      </div>
    </div>
  );
}
