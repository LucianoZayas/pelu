'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, ChevronDown, ChevronUp, Info } from 'lucide-react';
import type { ImportMetadata } from '@/features/import-presupuestos/types';
import { CancelarImportDialog } from './CancelarImportDialog';
import { ConfirmarImportDialog } from './ConfirmarImportDialog';

interface Props {
  presupuestoId: string;
  obraNombre: string;
  metadata: ImportMetadata;
  esObraNueva: boolean;
  esOperador?: boolean;
}

export function ImportPendienteBanner({
  presupuestoId,
  obraNombre,
  metadata,
  esObraNueva,
  esOperador = false,
}: Props) {
  const router = useRouter();
  const [showDescartes, setShowDescartes] = useState(false);

  const { archivo, items } = metadata;
  const { totalImportados, totalConWarning, descartes } = items;
  const descartesCount = descartes.length;

  return (
    <div className="sticky top-0 z-30 border-b bg-amber-50 dark:bg-amber-950/40">
      <div className="mx-auto max-w-7xl px-4 py-3" role="status" aria-live="polite">
        <div className="flex flex-wrap items-start gap-3">
          <AlertTriangle className="mt-0.5 size-5 shrink-0 text-amber-700 dark:text-amber-300" aria-hidden />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-amber-900 dark:text-amber-100">
              Estás revisando una importación desde Excel
              <span className="font-normal text-amber-800 dark:text-amber-200"> ({archivo.nombre})</span>
            </p>
            <p className="mt-0.5 text-xs text-amber-800 dark:text-amber-200">
              {totalImportados} items importados
              {totalConWarning > 0 && <> · {totalConWarning} con warnings</>}
              {descartesCount > 0 && (
                <>
                  {' · '}
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 underline underline-offset-2 hover:no-underline"
                    onClick={() => setShowDescartes((s) => !s)}
                  >
                    {descartesCount} descartados
                    {showDescartes ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
                  </button>
                </>
              )}
            </p>
            {showDescartes && descartesCount > 0 && (
              <div className="mt-2 rounded border border-amber-300 dark:border-amber-800 bg-white dark:bg-amber-950 p-2 text-xs">
                <ul className="space-y-1">
                  {descartes.slice(0, 10).map((d) => (
                    <li key={d.filaExcel}>
                      <span className="font-mono text-muted-foreground">r{d.filaExcel}</span>
                      {' — '}
                      <span className="text-amber-900 dark:text-amber-100">{d.razon}</span>
                      {d.detalle && <span className="text-muted-foreground"> · &quot;{d.detalle.slice(0, 60)}&quot;</span>}
                    </li>
                  ))}
                </ul>
                {descartesCount > 10 && (
                  <p className="mt-1 text-xs text-amber-800/70 dark:text-amber-200/70">
                    … y {descartesCount - 10} más (ver auditoría)
                  </p>
                )}
              </div>
            )}
            <p className="mt-2 inline-flex items-start gap-1 text-xs text-amber-800/80 dark:text-amber-200/80">
              <Info className="mt-0.5 size-3 shrink-0" aria-hidden />
              <span>Esta importación reemplaza el presupuesto completo. Próximamente vas a poder mergear cambios item por item.</span>
            </p>
          </div>
          <div className="flex shrink-0 gap-2">
            {esOperador ? (
              <p className="text-xs text-amber-800/80 dark:text-amber-200/80 py-1">
                Importación pendiente de revisión por un admin
              </p>
            ) : (
              <>
                <CancelarImportDialog
                  presupuestoId={presupuestoId}
                  obraNombre={obraNombre}
                  itemsImportados={totalImportados}
                  esObraNueva={esObraNueva}
                  onCancelled={(redirectTo) => router.push(redirectTo)}
                />
                <ConfirmarImportDialog
                  presupuestoId={presupuestoId}
                  itemsImportados={totalImportados}
                  itemsConWarning={totalConWarning}
                  descartesCount={descartesCount}
                />
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
