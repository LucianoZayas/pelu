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

export function EditorForm(props: Props) {
  const router = useRouter();
  const [version, setVersion] = useState(props.initialVersion);
  const [stale, setStale] = useState(false);
  const [saving, setSaving] = useState(false);

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
  const disabled = props.initialEstado !== 'borrador' || stale;

  async function save() {
    if (disabled) return;
    setSaving(true);
    const v = methods.getValues();
    const items = v.rubros.flatMap((r) => r.items.map((it, idx) => ({ ...it, rubroId: r.rubroId, orden: idx })));
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
      alert(r.error);
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

      <div className="grid grid-cols-3 gap-4 mb-6">
        <div><Label>Descripción</Label><Input {...methods.register('descripcion')} disabled={disabled} /></div>
        <div><Label>Markup default %</Label><Input type="number" step="0.01" {...methods.register('markupDefaultPorcentaje')} disabled={disabled} /></div>
        <div><Label>Cotización USD</Label><Input type="number" step="0.0001" {...methods.register('cotizacionUsd')} disabled={disabled} /></div>
      </div>

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

      <TotalesFooter monedaBase={props.monedaBase} />

      <div className="flex gap-2 mt-4">
        <Button onClick={save} disabled={!dirty || saving || disabled}>{saving ? 'Guardando...' : 'Guardar borrador'}</Button>
        {props.initialEstado === 'borrador' && (
          <>
            <FirmarDialog presupuestoId={props.presupuestoId} version={version} dirty={dirty} />
            <CancelarDialog presupuestoId={props.presupuestoId} version={version} />
          </>
        )}
      </div>
    </FormProvider>
  );
}
