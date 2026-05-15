'use client';

import { useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { guardarPresupuesto } from '../actions';
import { RubroAcordeon } from './rubro-acordeon';
import { StaleVersionBanner } from './stale-version-banner';
import { TotalesFooter } from './totales-footer';
import { FirmarDialog } from './firmar-dialog';
import { CancelarDialog } from './cancelar-dialog';
import { useAutosave } from '../hooks/use-autosave';
import { ImportPendienteBanner } from '@/features/import-presupuestos/components/ImportPendienteBanner';
import type { ImportMetadata } from '@/features/import-presupuestos/types';

type Item = {
  id?: string; rubroId: string; orden: number;
  descripcion: string; unidad: string; cantidad: string;
  costoUnitario: string; costoUnitarioMoneda: 'USD' | 'ARS';
  markupPorcentaje: string | null; notas: string | null;
};

type RubroGrupo = { rubroId: string; rubroNombre: string; items: Item[] };

type Props = {
  presupuestoId: string;
  initialVersion: number;
  initialDescripcion: string | null;
  initialMarkupDefault: string;
  initialCotizacion: string;
  initialEstado: 'borrador' | 'firmado' | 'cancelado';
  monedaBase: 'USD' | 'ARS';
  rubros: { id: string; nombre: string }[];
  initialGrupos: RubroGrupo[];
  // import
  importPendiente: boolean;
  importMetadata: unknown;
  presupuestoTipo: 'original' | 'adicional';
  obraNombre: string;
  userRol: 'admin' | 'operador';
};

// Una fila se considera "vacía" si no tiene descripción Y no se editaron
// los campos numéricos clave. Permite al usuario agregar filas por error
// y que se descarten silenciosamente al guardar (bug §3.1.6).
function esItemVacio(it: Item): boolean {
  const sinDesc = !it.descripcion || it.descripcion.trim() === '';
  const sinMontos = (!it.cantidad || it.cantidad === '0' || it.cantidad === '')
    && (!it.costoUnitario || it.costoUnitario === '0' || it.costoUnitario === '');
  return sinDesc && sinMontos;
}

export function EditorForm(props: Props) {
  const router = useRouter();
  const [version, setVersion] = useState(props.initialVersion);
  const [stale, setStale] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const esObraNueva = props.presupuestoTipo === 'original';

  const methods = useForm({
    defaultValues: {
      descripcion: props.initialDescripcion ?? '',
      markupDefaultPorcentaje: props.initialMarkupDefault,
      cotizacionUsd: props.initialCotizacion,
      rubros: props.initialGrupos,
    },
  });

  const dirty = methods.formState.isDirty;
  // Operador no puede editar mientras import_pendiente=true (espera confirmación del admin).
  const operadorBloqueado = props.userRol === 'operador' && props.importPendiente;
  const disabled = props.initialEstado !== 'borrador' || stale || operadorBloqueado;

  async function save() {
    if (disabled) return;
    setSaving(true);
    setSaveError(null);
    const v = methods.getValues();
    // Auto-discard de filas vacías: si el usuario agregó "+ Agregar item" pero
    // no escribió descripción ni montos, se descarta silenciosamente.
    const items = v.rubros.flatMap((r) =>
      r.items
        .filter((it) => !esItemVacio(it))
        .map((it, idx) => ({ ...it, rubroId: r.rubroId, orden: idx }))
    );
    const r = await guardarPresupuesto({
      presupuestoId: props.presupuestoId,
      version,
      descripcion: v.descripcion || null,
      markupDefaultPorcentaje: v.markupDefaultPorcentaje,
      cotizacionUsd: v.cotizacionUsd,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      items: items as any,
    });
    setSaving(false);
    if (r.ok) {
      setVersion((cur) => cur + 1);
      methods.reset(v); // limpia dirty
      router.refresh();
    } else if (r.code === 'STALE_VERSION') {
      setStale(true);
    } else {
      setSaveError(r.error);
    }
  }

  useAutosave(dirty && !stale && !saving, save, 30_000);

  return (
    <FormProvider {...methods}>
      {props.importPendiente && (
        <ImportPendienteBanner
          presupuestoId={props.presupuestoId}
          obraNombre={props.obraNombre}
          metadata={props.importMetadata as ImportMetadata}
          esObraNueva={esObraNueva}
          esOperador={props.userRol === 'operador'}
        />
      )}

      {stale && <StaleVersionBanner />}

      {/* Meta fields — card grid 3 cols */}
      <div className="mb-6 rounded-xl border bg-card shadow-[0_1px_2px_rgba(16,24,40,0.04),0_1px_3px_rgba(16,24,40,0.08)] p-5">
        <p className="mb-3 text-[10.5px] font-semibold uppercase tracking-[0.1em] text-muted-foreground/70">
          Parámetros del presupuesto
        </p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label className="text-[12px]">Descripción</Label>
            <Input
              {...methods.register('descripcion')}
              disabled={disabled}
              placeholder="Opcional"
              className="text-[13.5px]"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[12px]">Markup default %</Label>
            <Input
              type="number"
              step="0.01"
              {...methods.register('markupDefaultPorcentaje')}
              disabled={disabled}
              className="text-[13.5px] font-mono"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[12px]">Cotización USD</Label>
            <Input
              type="number"
              step="0.0001"
              {...methods.register('cotizacionUsd')}
              disabled={disabled}
              className="text-[13.5px] font-mono"
            />
          </div>
        </div>
      </div>

      {/* Rubros */}
      <div className="mb-2">
        {props.initialGrupos.map((g, idx) => (
          <RubroAcordeon
            key={g.rubroId}
            rubroIdx={idx}
            rubroNombre={g.rubroNombre}
            rubrosOptions={props.rubros}
            disabled={disabled}
            importPendiente={props.importPendiente}
          />
        ))}
      </div>

      <TotalesFooter monedaBase={props.monedaBase} />

      {saveError && (
        <div
          role="alert"
          className="mb-3 rounded-lg border border-red-300 bg-red-50 text-red-900 px-4 py-3 text-[13px] flex items-start gap-2"
        >
          <span className="font-semibold shrink-0">No se pudo guardar:</span>
          <span>{saveError}</span>
          <button
            type="button"
            onClick={() => setSaveError(null)}
            className="ml-auto text-red-700 hover:text-red-900 text-[18px] leading-none"
            aria-label="Cerrar"
          >×</button>
        </div>
      )}

      {/* Action toolbar */}
      <div className="sticky bottom-[61px] z-10 flex items-center gap-2 border-t bg-card/95 px-0 py-3.5 backdrop-blur-sm">
        <Button
          onClick={save}
          disabled={!dirty || saving || disabled}
          size="sm"
        >
          {saving ? 'Guardando…' : 'Guardar borrador'}
        </Button>
        {props.initialEstado === 'borrador' && (
          <>
            <FirmarDialog
              presupuestoId={props.presupuestoId}
              version={version}
              dirty={dirty}
              importPendiente={props.importPendiente}
            />
            <CancelarDialog presupuestoId={props.presupuestoId} version={version} />
          </>
        )}
      </div>
    </FormProvider>
  );
}
