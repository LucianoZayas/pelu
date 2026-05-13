export const dynamic = 'force-static';

function MacnaLogoSmall() {
  return (
    <div className="flex items-center justify-center gap-2 mb-6">
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
        <rect x="2" y="7" width="6" height="13" rx="0.5" fill="#3B5BFE" />
        <rect x="10" y="2" width="6" height="18" rx="0.5" fill="rgba(59,91,254,0.85)" />
        <rect x="18" y="11" width="2" height="9" rx="0.5" fill="rgba(59,91,254,0.65)" />
      </svg>
      <span className="font-semibold text-[16px] tracking-tight">Macna</span>
    </div>
  );
}

export default function ExpiradoPage() {
  return (
    <div className="min-h-screen grid place-items-center bg-[#F8F9FB]">
      <div className="w-full max-w-sm px-4">
        <div className="rounded-xl border bg-white px-6 py-8 shadow-[0_1px_2px_rgba(16,24,40,0.04),0_4px_16px_rgba(16,24,40,0.06)] text-center">
          <MacnaLogoSmall />
          <h1 className="text-[20px] font-semibold tracking-tight mb-2">
            El enlace expiró
          </h1>
          <p className="text-[13.5px] text-muted-foreground mb-4">
            Este link de acceso fue regenerado o ya no es válido. Por favor,
            contactá a la administración de Macna para recibir el enlace
            actualizado.
          </p>
          <p className="text-[12px] text-muted-foreground/70">
            +54 11 0000-0000 · admin@macna.com.ar
          </p>
        </div>
      </div>
    </div>
  );
}
