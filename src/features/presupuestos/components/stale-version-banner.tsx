import { AlertTriangle } from 'lucide-react';

export function StaleVersionBanner() {
  return (
    <div className="mb-5 flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3.5">
      <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden />
      <div>
        <p className="text-[13.5px] font-semibold text-destructive">
          Otro Admin editó este presupuesto
        </p>
        <p className="mt-0.5 text-[13px] text-destructive/80">
          Recargá la página para ver los cambios. Hasta entonces, no se puede guardar.
        </p>
      </div>
    </div>
  );
}
