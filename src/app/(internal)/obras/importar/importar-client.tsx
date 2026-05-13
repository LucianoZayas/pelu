'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { Toaster } from '@/components/ui/sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ChevronLeft, Loader2 } from 'lucide-react';
import { DropzoneXlsx } from '@/features/import-presupuestos/components/DropzoneXlsx';
import { PreviewSummary } from '@/features/import-presupuestos/components/PreviewSummary';
import {
  FormMetadatosObra,
  type MetadatosObraValues,
} from '@/features/import-presupuestos/components/FormMetadatosObra';
import {
  parsePreview,
  commitImportAction,
  type PreviewResult,
} from '@/features/import-presupuestos/actions';
import type { ItemPreview } from '@/features/import-presupuestos/types';

type Phase = 'idle' | 'parsing' | 'review' | 'committing';
type PreviewOk = Extract<PreviewResult, { ok: true }>;

function deriveRubrosDetectados(items: ItemPreview[]): string[] {
  return Array.from(new Set(items.map((i) => i.rubro)));
}

function deriveTotalProyectado(items: ItemPreview[]): number {
  return items.reduce((acc, i) => acc + i.costoUnitario * i.cantidad, 0);
}

export function ImportarClient() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>('idle');
  const [preview, setPreview] = useState<PreviewOk | null>(null);
  const [metadatos, setMetadatos] = useState<MetadatosObraValues | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [wasMetadatosTouched, setWasMetadatosTouched] = useState(false);
  const [confirmDiscardOpen, setConfirmDiscardOpen] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [, startTransition] = useTransition();

  const isCommitting = phase === 'committing';
  const isSubmitEnabled =
    phase === 'review' &&
    !!metadatos &&
    metadatos.codigoObra.trim() !== '' &&
    metadatos.nombreObra.trim() !== '' &&
    metadatos.clienteNombre.trim() !== '' &&
    metadatos.cotizacionUsd.trim() !== '';

  async function doParseFile(file: File) {
    setPhase('parsing');
    setPreview(null);
    setError(null);
    setWasMetadatosTouched(false);
    const fd = new FormData();
    fd.append('file', file);
    const result = await parsePreview(fd);
    if (!result.ok) {
      setError(result.error);
      setPhase('idle');
      return;
    }
    setPreview(result);
    setMetadatos({
      codigoObra: '',
      nombreObra: result.nombreObraDetectado ?? '',
      clienteNombre: '',
      porcentajeHonorarios: '16',
      cotizacionUsd: result.cotizacionDetectada?.toString() ?? '',
      monedaBase: 'ARS',
      markupDefaultPorcentaje: '30',
    });
    setPhase('review');
  }

  function handleFileReady(file: File) {
    // If we already have a preview with user-touched metadatos, ask for confirmation
    if (preview !== null && wasMetadatosTouched) {
      setPendingFile(file);
      setConfirmDiscardOpen(true);
      return;
    }
    // If metadatos untouched (or no preview yet), proceed silently
    startTransition(() => {
      void doParseFile(file);
    });
  }

  function handleDiscardConfirm() {
    setConfirmDiscardOpen(false);
    if (pendingFile) {
      const file = pendingFile;
      setPendingFile(null);
      startTransition(() => {
        void doParseFile(file);
      });
    }
  }

  function handleDiscardCancel() {
    setConfirmDiscardOpen(false);
    setPendingFile(null);
  }

  function handleMetadatosChange(values: MetadatosObraValues) {
    setMetadatos(values);
    setWasMetadatosTouched(true);
  }

  async function handleSubmit() {
    if (!preview || !metadatos) return;
    setPhase('committing');
    const result = await commitImportAction({
      items: preview.items,
      metadatosObra: { ...metadatos },
      importMetadata: {
        archivo: {
          nombre: preview.metadata.archivoNombre,
          tamanioBytes: 0,
          subidoEn: new Date().toISOString(),
        },
        parseo: {
          hojaParseada: preview.metadata.hojaParseada,
          headerRow: preview.metadata.headerRow,
          totalFilasExcel: preview.metadata.totalFilasExcel,
          cotizacionDetectada: preview.cotizacionDetectada,
          nombreObraDetectado: preview.nombreObraDetectado,
          mapeoColumnas: preview.mapeoColumnas,
        },
        items: {
          totalImportados: preview.items.length,
          totalConWarning: preview.items.filter((i) => i.warnings.length > 0).length,
          descartes: preview.descartes,
        },
      },
    });
    if (!result.ok) {
      setError(result.error);
      setPhase('review');
      toast.error(result.error);
      return;
    }
    router.push(result.redirectTo);
  }

  const rubrosDetectados = preview ? deriveRubrosDetectados(preview.items) : [];
  const totalProyectado = preview ? deriveTotalProyectado(preview.items) : 0;

  return (
    <div className="px-8 py-7 max-w-[1280px]">
      <Toaster />

      {/* Header */}
      <div className="mb-7 flex items-center gap-3">
        <Link
          href="/obras"
          className="inline-flex items-center gap-1 text-[13px] text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft className="size-4" aria-hidden />
          Obras
        </Link>
        <span className="text-muted-foreground/40">/</span>
        <div>
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/85 mb-0.5">
            IMPORTAR
          </p>
          <h1 className="text-[26px] font-semibold tracking-tight leading-tight text-foreground">
            Nueva obra desde Excel
          </h1>
        </div>
      </div>

      {/* Dropzone */}
      <DropzoneXlsx
        onFileReady={handleFileReady}
        isPending={phase === 'parsing'}
      />

      {/* Error general */}
      {error && (
        <p role="alert" className="mt-3 text-[13px] text-destructive">
          {error}
        </p>
      )}

      {/* Preview y formulario — solo en fase review/committing */}
      {(['review', 'committing'] as Phase[]).includes(phase) && preview && metadatos && (
        <div className="mt-6 space-y-5">
          {/* PreviewSummary */}
          <PreviewSummary
            itemsImportados={preview.items.length}
            itemsConWarning={preview.items.filter((i) => i.warnings.length > 0).length}
            totalProyectado={totalProyectado}
            monedaBase={metadatos.monedaBase}
            cotizacionDetectada={preview.cotizacionDetectada}
            hojaParseada={preview.metadata.hojaParseada}
            descartes={preview.descartes}
            rubrosDetectados={rubrosDetectados}
            rubrosNuevos={[]}
          />

          {/* FormMetadatosObra */}
          <Card className="shadow-[0_1px_2px_rgba(16,24,40,0.04),0_1px_3px_rgba(16,24,40,0.08)]">
            <CardHeader className="pb-4">
              <CardTitle className="text-[15px] font-semibold">Datos de la obra</CardTitle>
            </CardHeader>
            <CardContent>
              <FormMetadatosObra
                initialValues={metadatos}
                onChange={handleMetadatosChange}
                disabled={isCommitting}
                cotizacionWarning={
                  preview.cotizacionDetectada === null
                    ? 'No se detectó cotización en el Excel — completá manualmente'
                    : undefined
                }
              />
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex items-center gap-3 pt-1">
            <Button
              onClick={handleSubmit}
              disabled={!isSubmitEnabled || isCommitting}
            >
              {isCommitting ? (
                <>
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                  Importando…
                </>
              ) : (
                <>Importar {preview.items.length} items</>
              )}
            </Button>
            <Link
              href="/obras"
              className="text-[13px] text-muted-foreground hover:text-foreground transition-colors"
            >
              Cancelar
            </Link>
          </div>
        </div>
      )}

      {/* Confirm discard dialog */}
      <Dialog open={confirmDiscardOpen} onOpenChange={setConfirmDiscardOpen}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>¿Descartar progreso?</DialogTitle>
            <DialogDescription>
              Los datos del formulario se perderán. Vas a procesar el nuevo archivo desde cero.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={handleDiscardCancel}>
              Cancelar
            </Button>
            <Button onClick={handleDiscardConfirm}>
              Sí, descartar y continuar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
