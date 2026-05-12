'use client';

import { useRef, useState, useTransition } from 'react';
import {
  Upload, FileSpreadsheet, X, AlertTriangle, ChevronDown, ChevronUp, Info,
  Check, Loader2, Trash2, AlertCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import { Toaster } from '@/components/ui/sonner';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const MAX_BYTES = 5 * 1024 * 1024;

// ────────────────────────────────────────────────────────────
// Componente 1 · Dropzone XLSX
// ────────────────────────────────────────────────────────────
function DropzoneXlsx({ onFileReady }: { onFileReady: (f: File) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const validate = (f: File) => {
    if (!f.name.toLowerCase().endsWith('.xlsx')) return 'El archivo debe ser .xlsx (Excel moderno).';
    if (f.size > MAX_BYTES) return `El archivo supera 5 MB (pesa ${(f.size / 1024 / 1024).toFixed(1)} MB).`;
    return null;
  };

  const handleFile = (f: File) => {
    const err = validate(f);
    if (err) { setError(err); setFile(null); return; }
    setError(null);
    setFile(f);
    startTransition(() => {
      setTimeout(() => onFileReady(f), 1500);
    });
  };

  return (
    <div className="w-full">
      <div
        className={cn(
          'flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed px-6 py-12 transition-colors',
          isDragging ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-muted-foreground/50',
        )}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          const f = e.dataTransfer.files?.[0];
          if (f) handleFile(f);
        }}
      >
        {file ? (
          <>
            <FileSpreadsheet className="size-10 text-primary" aria-hidden />
            <div className="text-sm font-medium">{file.name}</div>
            <div className="text-xs text-muted-foreground">
              {(file.size / 1024).toFixed(0)} KB · {isPending ? 'Analizando…' : 'Listo'}
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { setFile(null); if (inputRef.current) inputRef.current.value = ''; }}
              disabled={isPending}
            >
              <X className="size-4" aria-hidden /> Quitar
            </Button>
          </>
        ) : (
          <>
            <Upload className="size-10 text-muted-foreground" aria-hidden />
            <div className="text-base font-medium">Arrastrá un Excel acá</div>
            <div className="text-sm text-muted-foreground">o</div>
            <Button onClick={() => inputRef.current?.click()}>Seleccionar archivo</Button>
            <div className="text-xs text-muted-foreground">.xlsx · hasta 5 MB</div>
          </>
        )}
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx"
          className="sr-only"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
        />
      </div>
      {error && (
        <p role="alert" className="mt-2 text-sm text-destructive">{error}</p>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// Componente 2 · Indicador por fila
// ────────────────────────────────────────────────────────────
type RowEstado = 'ok' | 'warning' | 'error';
const rowStyles: Record<RowEstado, { Icon: typeof Check; label: string; tone: string }> = {
  ok: { Icon: Check, label: 'OK', tone: 'text-emerald-600 dark:text-emerald-400' },
  warning: { Icon: AlertTriangle, label: 'Warning', tone: 'text-amber-600 dark:text-amber-400' },
  error: { Icon: AlertCircle, label: 'Error', tone: 'text-destructive' },
};

function ImportRowStatus({ filaExcel, estado, warnings = [] }: {
  filaExcel: number;
  estado: RowEstado;
  warnings?: { tipo: string; mensaje: string }[];
}) {
  const { Icon, label, tone } = rowStyles[estado];
  const tooltip = warnings.length > 0
    ? warnings.map((w) => `• ${w.mensaje}`).join('\n')
    : `Fila Excel r${filaExcel} — ${label}`;
  return (
    <span
      className={cn('inline-flex items-center gap-1.5 text-xs font-mono', tone)}
      title={tooltip}
      aria-label={`${label}, fila Excel ${filaExcel}${warnings.length ? `, ${warnings.length} warnings` : ''}`}
    >
      <Icon className="size-3.5" aria-hidden />
      <span>r{filaExcel}</span>
    </span>
  );
}

// ────────────────────────────────────────────────────────────
// Componente 3 · Diálogo "Confirmar importación"
// ────────────────────────────────────────────────────────────
function ConfirmarImportDialog({ itemsImportados, itemsConWarning, descartesCount }: {
  itemsImportados: number; itemsConWarning: number; descartesCount: number;
}) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const handleConfirm = () => {
    startTransition(() => {
      setTimeout(() => {
        toast.success('Importación confirmada');
        setOpen(false);
      }, 800);
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm"><Check className="size-4" /> Confirmar importación</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Confirmar importación</DialogTitle>
          <DialogDescription>
            Vas a confirmar la importación de <strong>{itemsImportados} items</strong>.
            Después de confirmar, el presupuesto pasa a borrador editable normal y queda registrado en auditoría.
          </DialogDescription>
        </DialogHeader>
        {(itemsConWarning > 0 || descartesCount > 0) && (
          <div className="rounded border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 px-3 py-2 text-sm">
            <ul className="space-y-1 text-amber-900 dark:text-amber-100">
              {itemsConWarning > 0 && <li>⚠ {itemsConWarning} items tienen warnings (rubro heredado, costo en 0, etc.)</li>}
              {descartesCount > 0 && <li>⚠ {descartesCount} filas del Excel quedaron afuera</li>}
            </ul>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={isPending}>Cancelar</Button>
          <Button onClick={handleConfirm} disabled={isPending}>
            {isPending ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
            Confirmar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ────────────────────────────────────────────────────────────
// Componente 4 · Diálogo "Cancelar importación" (destructivo)
// ────────────────────────────────────────────────────────────
function CancelarImportDialog({ obraNombre, itemsImportados, esObraNueva }: {
  obraNombre: string; itemsImportados: number; esObraNueva: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const handleCancel = () => {
    startTransition(() => {
      setTimeout(() => {
        toast.success(esObraNueva ? 'Importación cancelada, obra eliminada' : 'Importación cancelada, presupuesto anterior restaurado');
        setOpen(false);
      }, 800);
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="sm"><Trash2 className="size-4" /> Cancelar importación</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="size-5 text-destructive" aria-hidden />
            Cancelar importación
          </DialogTitle>
          <DialogDescription>Esta acción no se puede deshacer.</DialogDescription>
        </DialogHeader>
        <div className="space-y-2 text-sm">
          <p>Vas a perder:</p>
          <ul className="list-disc pl-5 text-muted-foreground">
            <li>{itemsImportados} items importados</li>
            <li>Los ajustes que hayas hecho en la grilla</li>
          </ul>
          {esObraNueva ? (
            <p className="mt-2 rounded bg-destructive/10 px-3 py-2 text-destructive">
              También se va a eliminar la obra <strong>{obraNombre}</strong>.
            </p>
          ) : (
            <p className="mt-2 rounded bg-muted px-3 py-2 text-muted-foreground">
              Se restaura el presupuesto anterior de <strong>{obraNombre}</strong>.
            </p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={isPending}>Volver</Button>
          <Button variant="destructive" onClick={handleCancel} disabled={isPending}>
            {isPending ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
            Sí, cancelar importación
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ────────────────────────────────────────────────────────────
// Componente 5 · Banner sticky "Import pendiente"
// ────────────────────────────────────────────────────────────
const descartesMock = [
  { filaExcel: 23, razon: 'fila separadora/total', detalle: 'SUBTOTAL DEMOLICION Y TRABAJOS PREVIOS' },
  { filaExcel: 105, razon: 'sin descripción', detalle: '' },
  { filaExcel: 128, razon: 'sin costo material ni mano de obra', detalle: 'Adelanto' },
  { filaExcel: 226, razon: 'fila separadora/total', detalle: 'HONORARIOS 16%' },
];

function ImportPendienteBanner({
  obraNombre, archivoNombre, itemsImportados, itemsConWarning, descartes, esObraNueva,
}: {
  obraNombre: string;
  archivoNombre: string;
  itemsImportados: number;
  itemsConWarning: number;
  descartes: typeof descartesMock;
  esObraNueva: boolean;
}) {
  const [showDescartes, setShowDescartes] = useState(false);

  return (
    <div className="sticky top-0 z-30 border-b bg-amber-50 dark:bg-amber-950/40">
      <div className="mx-auto max-w-7xl px-4 py-3" role="status" aria-live="polite">
        <div className="flex flex-wrap items-start gap-3">
          <AlertTriangle className="mt-0.5 size-5 shrink-0 text-amber-700 dark:text-amber-300" aria-hidden />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-amber-900 dark:text-amber-100">
              Estás revisando una importación desde Excel
              <span className="font-normal text-amber-800 dark:text-amber-200"> ({archivoNombre})</span>
            </p>
            <p className="mt-0.5 text-xs text-amber-800 dark:text-amber-200">
              {itemsImportados} items importados
              {itemsConWarning > 0 && <> · {itemsConWarning} con warnings</>}
              {descartes.length > 0 && (
                <>
                  {' · '}
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 underline underline-offset-2 hover:no-underline"
                    onClick={() => setShowDescartes((s) => !s)}
                  >
                    {descartes.length} descartados
                    {showDescartes ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
                  </button>
                </>
              )}
            </p>
            {showDescartes && descartes.length > 0 && (
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
              </div>
            )}
            <p className="mt-2 inline-flex items-start gap-1 text-xs text-amber-800/80 dark:text-amber-200/80">
              <Info className="mt-0.5 size-3 shrink-0" aria-hidden />
              <span>Esta importación reemplaza el presupuesto completo. Próximamente vas a poder mergear cambios item por item.</span>
            </p>
          </div>
          <div className="flex shrink-0 gap-2">
            <CancelarImportDialog
              obraNombre={obraNombre}
              itemsImportados={itemsImportados}
              esObraNueva={esObraNueva}
            />
            <ConfirmarImportDialog
              itemsImportados={itemsImportados}
              itemsConWarning={itemsConWarning}
              descartesCount={descartes.length}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// Página showcase
// ────────────────────────────────────────────────────────────
export default function PreviewImporterPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Banner sticky: arriba de todo, como va a ir en el editor real */}
      <ImportPendienteBanner
        obraNombre="Macna-2026-042"
        archivoNombre="MACNA ADMINISTRACION - Lucho (1).xlsx"
        itemsImportados={47}
        itemsConWarning={8}
        descartes={descartesMock}
        esObraNueva
      />

      <main className="mx-auto max-w-5xl space-y-12 px-4 py-10">
        <header className="space-y-2">
          <p className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Preview · importer XLSX</p>
          <h1 className="text-3xl font-semibold">Mockups de componentes</h1>
          <p className="text-sm text-muted-foreground">
            Showcase de los componentes nuevos del diseño del importer. Mocks &mdash; los botones disparan toasts pero no tocan la DB.
            Esta página es temporal: vive en <code className="rounded bg-muted px-1.5 py-0.5 text-xs">src/app/preview-importer/page.tsx</code>{' '}
            y se borra cuando arranque la implementación real.
          </p>
        </header>

        {/* 1 · Dropzone */}
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">1 · Dropzone para subir el Excel</h2>
          <p className="text-sm text-muted-foreground">
            Drag-and-drop o click. Valida extensión <code className="text-xs">.xlsx</code> y tamaño max 5 MB. Si pasa, simula 1.5s de parseo y dispara un toast.
          </p>
          <DropzoneXlsx onFileReady={(f) => toast.success(`Archivo listo: ${f.name}`, { description: 'En producción, acá arranca el parseo server-side' })} />
        </section>

        {/* 2 · Indicadores por fila */}
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">2 · Indicadores de estado por fila (en la grilla del editor)</h2>
          <p className="text-sm text-muted-foreground">
            Una columna nueva en el editor existente cuando <code className="text-xs">import_pendiente=true</code>. Hover sobre cada chip para ver el detalle.
          </p>
          <div className="rounded-lg border bg-card p-4">
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground">
                <tr className="border-b">
                  <th className="pb-2 text-left font-medium">Estado</th>
                  <th className="pb-2 text-left font-medium">Rubro</th>
                  <th className="pb-2 text-left font-medium">Ubicación</th>
                  <th className="pb-2 text-left font-medium">Descripción</th>
                  <th className="pb-2 text-right font-medium">Costo</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b last:border-0">
                  <td className="py-2">
                    <ImportRowStatus filaExcel={107} estado="ok" />
                  </td>
                  <td className="py-2">DEMOLICIÓN Y ALBAÑILERIA</td>
                  <td className="py-2 text-muted-foreground">GENERAL</td>
                  <td className="py-2">MATERIALES DEMOLICION — Material</td>
                  <td className="py-2 text-right font-mono">$2.500.000</td>
                </tr>
                <tr className="border-b last:border-0">
                  <td className="py-2">
                    <ImportRowStatus
                      filaExcel={137}
                      estado="warning"
                      warnings={[
                        { tipo: 'rubro_heredado', mensaje: 'Rubro heredado de fila anterior (MARMOLERÍA)' },
                      ]}
                    />
                  </td>
                  <td className="py-2 italic text-muted-foreground">MARMOLERÍA</td>
                  <td className="py-2 text-muted-foreground">LAVADERO</td>
                  <td className="py-2">Lavadero. negro boreal — Material</td>
                  <td className="py-2 text-right font-mono">$400.000</td>
                </tr>
                <tr className="border-b last:border-0">
                  <td className="py-2">
                    <ImportRowStatus
                      filaExcel={128}
                      estado="error"
                      warnings={[
                        { tipo: 'costo_invalido', mensaje: 'Valor "Adelanto" en COSTO TOTAL no es numérico — importado como 0' },
                      ]}
                    />
                  </td>
                  <td className="py-2">MUEBLES DE OBRA</td>
                  <td className="py-2 text-muted-foreground">—</td>
                  <td className="py-2">Adelanto</td>
                  <td className="py-2 text-right font-mono text-destructive">$0</td>
                </tr>
                <tr className="border-b last:border-0">
                  <td className="py-2">
                    <ImportRowStatus filaExcel={136} estado="ok" />
                  </td>
                  <td className="py-2">MARMOLERÍA</td>
                  <td className="py-2 text-muted-foreground">COCINA</td>
                  <td className="py-2">Cocina. negro boreal — Mano de obra</td>
                  <td className="py-2 text-right font-mono">$600.000</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* 3 · Diálogos */}
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">3 · Diálogos de confirmación y cancelación</h2>
          <p className="text-sm text-muted-foreground">
            Los mismos botones del banner sticky, pero acá los podés clickear sin scrollear. El de cancelar tiene variante destructiva.
          </p>
          <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-card p-4">
            <ConfirmarImportDialog itemsImportados={47} itemsConWarning={8} descartesCount={4} />
            <CancelarImportDialog obraNombre="Macna-2026-042" itemsImportados={47} esObraNueva />
            <span className="text-xs text-muted-foreground">↑ caso &quot;obra nueva&quot;</span>
          </div>
          <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-card p-4">
            <CancelarImportDialog obraNombre="Macna-2025-031" itemsImportados={23} esObraNueva={false} />
            <span className="text-xs text-muted-foreground">↑ caso &quot;re-import sobre obra existente&quot; (mensaje cambia)</span>
          </div>
        </section>

        {/* 4 · Placeholder editor */}
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">4 · Cómo se ve dentro del editor (placeholder)</h2>
          <p className="text-sm text-muted-foreground">
            El banner sticky de arriba ya está montado en esta página. Si scrolleás, queda fijo arriba. El editor real (Plan 3) va donde está este placeholder.
          </p>
          <div className="rounded-lg border-2 border-dashed bg-muted/30 px-6 py-16 text-center text-sm text-muted-foreground">
            <FileSpreadsheet className="mx-auto mb-2 size-10 opacity-40" aria-hidden />
            <p>[ Editor de presupuesto existente (Plan 3) va acá ]</p>
            <p className="mt-1 text-xs">Tabla con virtualización, acordeón por rubro, autosave 30s, sign/cancel</p>
          </div>
        </section>

        <footer className="border-t pt-6 text-xs text-muted-foreground">
          <p>
            Cuando arranque la implementación, los componentes se mueven a{' '}
            <code className="rounded bg-muted px-1.5 py-0.5">src/features/import-presupuestos/components/</code>{' '}
            y las server actions reales reemplazan los mocks.
          </p>
        </footer>
      </main>

      <Toaster />
    </div>
  );
}
