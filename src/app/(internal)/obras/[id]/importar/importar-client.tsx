'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { Toaster } from '@/components/ui/sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, ChevronLeft, Loader2 } from 'lucide-react';
import { DropzoneXlsx } from '@/features/import-presupuestos/components/DropzoneXlsx';
import { PreviewSummary } from '@/features/import-presupuestos/components/PreviewSummary';
import {
  parsePreview,
  commitImportAction,
  type PreviewResult,
} from '@/features/import-presupuestos/actions';
import type { ItemPreview } from '@/features/import-presupuestos/types';

type Phase = 'idle' | 'parsing' | 'review' | 'confirming' | 'committing';
type PreviewOk = Extract<PreviewResult, { ok: true }>;

interface Props {
  obraId: string;
  obraNombre: string;
  obraCodigo: string;
  monedaBase: 'USD' | 'ARS';
  cotizacionUsdInicial: string;
  markupDefaultPorcentaje: string;
  porcentajeHonorarios: string;
  caso: 'sin_presupuesto' | 'reemplazar_borrador' | 'crear_adicional';
}

function deriveRubrosDetectados(items: ItemPreview[]): string[] {
  return Array.from(new Set(items.map((i) => i.rubro)));
}

function deriveTotalProyectado(items: ItemPreview[]): number {
  return items.reduce((acc, i) => acc + i.costoUnitario * i.cantidad, 0);
}

export function ImportarObraExistenteClient(props: Props) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>('idle');
  const [preview, setPreview] = useState<PreviewOk | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const isCommitting = phase === 'committing';

  async function handleFileReady(file: File) {
    setPhase('parsing');
    setPreview(null);
    setError(null);
    const fd = new FormData();
    fd.append('file', file);
    const result = await parsePreview(fd);
    if (!result.ok) {
      setError(result.error);
      setPhase('idle');
      toast.error(result.error);
      return;
    }
    setPreview(result);
    setPhase('review');
  }

  function handleImportClick() {
    if (props.caso === 'sin_presupuesto') {
      void doCommit();
    } else {
      setConfirmOpen(true);
    }
  }

  async function doCommit() {
    if (!preview) return;
    setPhase('committing');
    setConfirmOpen(false);
    const result = await commitImportAction({
      items: preview.items,
      metadatosObra: {
        codigoObra: props.obraCodigo,
        nombreObra: props.obraNombre,
        clienteNombre: '',
        monedaBase: props.monedaBase,
        cotizacionUsd:
          preview.cotizacionDetectada?.toString() ?? props.cotizacionUsdInicial,
        markupDefaultPorcentaje: props.markupDefaultPorcentaje,
        porcentajeHonorarios: props.porcentajeHonorarios,
      },
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
          totalConWarning: preview.items.filter((i) => i.warnings.length > 0)
            .length,
          descartes: preview.descartes,
        },
      },
      obraIdExistente: props.obraId,
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
  const isReview = phase === 'review' || phase === 'committing';

  return (
    <div className="px-8 py-7 max-w-[1280px]">
      <Toaster />

      {/* Header */}
      <div className="mb-7 flex items-center gap-3">
        <Link
          href={`/obras/${props.obraId}`}
          className="inline-flex items-center gap-1 text-[13px] text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft className="size-4" aria-hidden />
          {props.obraNombre}
        </Link>
        <span className="text-muted-foreground/40">/</span>
        <div>
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/85 mb-0.5">
            IMPORTAR · {props.obraCodigo}
          </p>
          <h1 className="text-[26px] font-semibold tracking-tight leading-tight text-foreground">
            Importar presupuesto desde Excel
          </h1>
        </div>
      </div>

      {/* Caso info banner */}
      {props.caso === 'reemplazar_borrador' && (
        <Alert className="mb-5">
          <AlertCircle className="size-4" />
          <AlertTitle>Esta obra ya tiene un presupuesto borrador</AlertTitle>
          <AlertDescription>
            Al importar, el borrador actual queda guardado en historial y se
            crea uno nuevo con los items del Excel.
          </AlertDescription>
        </Alert>
      )}
      {props.caso === 'crear_adicional' && (
        <Alert className="mb-5">
          <AlertCircle className="size-4" />
          <AlertTitle>Esta obra tiene presupuestos firmados</AlertTitle>
          <AlertDescription>
            Al importar, se crea un presupuesto adicional (los firmados no se
            modifican).
          </AlertDescription>
        </Alert>
      )}

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

      {/* Preview — solo en fase review/committing */}
      {isReview && preview && (
        <div className="mt-6 space-y-5">
          <PreviewSummary
            itemsImportados={preview.items.length}
            itemsConWarning={
              preview.items.filter((i) => i.warnings.length > 0).length
            }
            totalProyectado={totalProyectado}
            monedaBase={props.monedaBase}
            cotizacionDetectada={preview.cotizacionDetectada}
            hojaParseada={preview.metadata.hojaParseada}
            descartes={preview.descartes}
            rubrosDetectados={rubrosDetectados}
            rubrosNuevos={[]}
          />

          {/* Actions */}
          <div className="flex items-center gap-3 pt-1">
            <Button
              onClick={handleImportClick}
              disabled={isCommitting}
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
              href={`/obras/${props.obraId}`}
              className="text-[13px] text-muted-foreground hover:text-foreground transition-colors"
            >
              Cancelar
            </Link>
          </div>
        </div>
      )}

      {/* Pre-flight dialog — reemplazar_borrador */}
      <Dialog
        open={confirmOpen && props.caso === 'reemplazar_borrador'}
        onOpenChange={setConfirmOpen}
      >
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>¿Reemplazar el borrador actual?</DialogTitle>
            <DialogDescription>
              Vas a crear un presupuesto nuevo con{' '}
              {preview?.items.length ?? 0} items del Excel. El borrador actual
              queda guardado en el historial y se puede recuperar si cancelás
              esta importación más adelante.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={() => void doCommit()}>Reemplazar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Pre-flight dialog — crear_adicional */}
      <Dialog
        open={confirmOpen && props.caso === 'crear_adicional'}
        onOpenChange={setConfirmOpen}
      >
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>¿Crear presupuesto adicional?</DialogTitle>
            <DialogDescription>
              Vas a crear un presupuesto adicional con{' '}
              {preview?.items.length ?? 0} items del Excel. Los presupuestos
              firmados no se modifican.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={() => void doCommit()}>Crear adicional</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
