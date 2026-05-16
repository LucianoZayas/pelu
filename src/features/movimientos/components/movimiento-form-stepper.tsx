'use client';

import { useState, useTransition, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowDownToLine, ArrowUpFromLine, ArrowLeftRight, Save, X, AlertCircle,
  Check, ChevronLeft, ChevronRight, Search,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Toaster } from '@/components/ui/sonner';
import { cn } from '@/lib/utils';
import { crearMovimiento, editarMovimiento } from '../actions';
import { MovimientoPreview } from './movimiento-preview';

type Concepto = {
  id: string;
  codigo: string;
  nombre: string;
  tipo: 'ingreso' | 'egreso' | 'transferencia';
  requiereObra: boolean;
  requiereProveedor: boolean;
  esNoRecuperable: boolean;
};

type Cuenta = { id: string; nombre: string; moneda: 'USD' | 'ARS'; tipo: string };
type ObraOption = { id: string; codigo: string; nombre: string };
type ParteOption = { id: string; nombre: string; tipo: string };
type ProveedorOption = { id: string; nombre: string };

// Valores iniciales para modo edición.
export type MovimientoInitialValues = {
  id: string;
  version: number;
  tipoOp: TipoOp;
  conceptoId: string;
  fecha: string; // YYYY-MM-DD
  cuentaId: string;
  cuentaDestinoId: string;
  monto: string;
  montoDestino: string;
  cotizacion: string;
  obraId: string;
  proveedorId: string;
  parteOrigenId: string;
  parteDestinoId: string;
  descripcion: string;
  numeroComprobante: string;
  esNoRecuperable: boolean;
};

type Props = {
  conceptos: Concepto[];
  cuentas: Cuenta[];
  obras: ObraOption[];
  partes: ParteOption[];
  proveedores: ProveedorOption[];
  // Si viene desde /obras/[id]/flujo, preselecciona esa obra.
  obraIdInicial?: string;
  // Si está definido, el form opera en modo edición.
  edit?: MovimientoInitialValues;
};

type TipoOp = 'entrada' | 'salida' | 'transferencia';

const TIPO_CONCEPTO_PARA_OP: Record<TipoOp, 'ingreso' | 'egreso' | 'transferencia'> = {
  entrada: 'ingreso',
  salida: 'egreso',
  transferencia: 'transferencia',
};

const TIPO_META: Record<TipoOp, { Icon: typeof ArrowDownToLine; label: string; desc: string; bg: string; border: string; text: string; hoverBg: string; hoverBorder: string }> = {
  entrada: {
    Icon: ArrowDownToLine, label: 'Ingreso',
    desc: 'Cobros, honorarios, beneficios — dinero que entra',
    bg: 'bg-emerald-50', border: 'border-emerald-300', text: 'text-emerald-800',
    hoverBg: 'hover:bg-emerald-50/70', hoverBorder: 'hover:border-emerald-300',
  },
  salida: {
    Icon: ArrowUpFromLine, label: 'Egreso',
    desc: 'Pagos, sueldos, gastos — dinero que sale',
    bg: 'bg-red-50', border: 'border-red-300', text: 'text-red-800',
    hoverBg: 'hover:bg-red-50/70', hoverBorder: 'hover:border-red-300',
  },
  transferencia: {
    Icon: ArrowLeftRight, label: 'Transferencia',
    desc: 'Mover plata entre cuentas propias (incluye cambio USD ↔ ARS)',
    bg: 'bg-blue-50', border: 'border-blue-300', text: 'text-blue-800',
    hoverBg: 'hover:bg-blue-50/70', hoverBorder: 'hover:border-blue-300',
  },
};

export function MovimientoFormStepper({ conceptos, cuentas, obras, partes, proveedores, obraIdInicial, edit }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const isEdit = edit !== undefined;
  // En modo edición saltamos directo al paso 2 (no se puede cambiar el tipo).
  const [step, setStep] = useState<1 | 2 | 3>(isEdit ? 2 : 1);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const todayIso = new Date().toISOString().slice(0, 10);

  const [tipoOp, setTipoOp] = useState<TipoOp | null>(edit?.tipoOp ?? null);
  const [conceptoId, setConceptoId] = useState<string>(edit?.conceptoId ?? '');
  const [conceptoSearch, setConceptoSearch] = useState('');
  const [fecha, setFecha] = useState(edit?.fecha ?? todayIso);
  const [cuentaId, setCuentaId] = useState(edit?.cuentaId ?? '');
  const [cuentaDestinoId, setCuentaDestinoId] = useState(edit?.cuentaDestinoId ?? '');
  const [monto, setMonto] = useState(edit?.monto ?? '');
  const [montoDestino, setMontoDestino] = useState(edit?.montoDestino ?? '');
  const [cotizacion, setCotizacion] = useState(edit?.cotizacion ?? '');
  const [obraId, setObraId] = useState(edit?.obraId ?? obraIdInicial ?? '');
  const [proveedorId, setProveedorId] = useState(edit?.proveedorId ?? '');
  const [parteOrigenId, setParteOrigenId] = useState(edit?.parteOrigenId ?? '');
  const [parteDestinoId, setParteDestinoId] = useState(edit?.parteDestinoId ?? '');
  const [descripcion, setDescripcion] = useState(edit?.descripcion ?? '');
  const [numeroComprobante, setNumeroComprobante] = useState(edit?.numeroComprobante ?? '');
  const [esNoRecuperable, setEsNoRecuperable] = useState(edit?.esNoRecuperable ?? false);

  const concepto = useMemo(() => conceptos.find((c) => c.id === conceptoId), [conceptos, conceptoId]);
  const cuentaOrigen = useMemo(() => cuentas.find((c) => c.id === cuentaId), [cuentas, cuentaId]);
  const cuentaDestino = useMemo(() => cuentas.find((c) => c.id === cuentaDestinoId), [cuentas, cuentaDestinoId]);
  const isTransfer = tipoOp === 'transferencia';
  const requiereMontoDestino = !!(isTransfer && cuentaOrigen && cuentaDestino && cuentaOrigen.moneda !== cuentaDestino.moneda);

  const conceptosFiltrados = useMemo(() => {
    if (!tipoOp) return [];
    const tipoConcepto = TIPO_CONCEPTO_PARA_OP[tipoOp];
    const search = conceptoSearch.trim().toLowerCase();
    return conceptos
      .filter((c) => c.tipo === tipoConcepto)
      .filter((c) => !search || c.codigo.toLowerCase().includes(search) || c.nombre.toLowerCase().includes(search));
  }, [conceptos, tipoOp, conceptoSearch]);

  // Cuando cambia el concepto, sincronizamos esNoRecuperable con el default del
  // concepto nuevo. En edición no aplicamos esto: respetamos el valor original
  // del movimiento (que se cargó desde la DB).
  useEffect(() => {
    if (!isEdit && concepto) setEsNoRecuperable(concepto.esNoRecuperable);
  }, [concepto, isEdit]);

  function elegirTipo(t: TipoOp) {
    setTipoOp(t);
    setConceptoId(''); // reset por si venía de otro tipo
    setConceptoSearch('');
    setStep(2);
  }

  function step2Valido(): { ok: boolean; faltan: string[] } {
    const faltan: string[] = [];
    if (!conceptoId) faltan.push('Concepto');
    if (!cuentaId) faltan.push(isTransfer ? 'Cuenta origen' : 'Cuenta');
    if (isTransfer && !cuentaDestinoId) faltan.push('Cuenta destino');
    if (!monto || Number(monto) <= 0) faltan.push('Monto');
    if (requiereMontoDestino && (!montoDestino || Number(montoDestino) <= 0)) faltan.push('Monto destino');
    return { ok: faltan.length === 0, faltan };
  }

  function step3Valido(): { ok: boolean; faltan: string[] } {
    const faltan: string[] = [];
    if (concepto?.requiereObra && !obraId) faltan.push('Obra');
    if (concepto?.requiereProveedor && !proveedorId) faltan.push('Proveedor');
    return { ok: faltan.length === 0, faltan };
  }

  const missingRequired = useMemo(() => {
    const m: string[] = [];
    if (!tipoOp) return ['Tipo de movimiento'];
    if (!conceptoId) m.push('Concepto');
    if (!cuentaId) m.push('Cuenta');
    if (isTransfer && !cuentaDestinoId) m.push('Cuenta destino');
    if (!monto || Number(monto) <= 0) m.push('Monto');
    if (requiereMontoDestino && (!montoDestino || Number(montoDestino) <= 0)) m.push('Monto destino');
    if (concepto?.requiereObra && !obraId) m.push('Obra');
    if (concepto?.requiereProveedor && !proveedorId) m.push('Proveedor');
    return m;
  }, [tipoOp, conceptoId, cuentaId, cuentaDestinoId, monto, montoDestino, requiereMontoDestino, isTransfer, concepto, obraId, proveedorId]);

  function handleAvanzar() {
    setErrorMsg(null);
    if (step === 1 && !tipoOp) return;
    if (step === 2) {
      const v = step2Valido();
      if (!v.ok) { setErrorMsg(`Falta: ${v.faltan.join(', ')}`); return; }
      setStep(3);
      return;
    }
    if (step === 3) handleSubmit();
  }

  function handleVolver() {
    setErrorMsg(null);
    // En edición el paso 1 no existe (tipo no se puede cambiar), del 2 se sale del form.
    if (step === 2 && !isEdit) setStep(1);
    else if (step === 3) setStep(2);
  }

  function handleSubmit() {
    if (!tipoOp || !concepto) return;
    const v3 = step3Valido();
    if (!v3.ok) { setErrorMsg(`Falta: ${v3.faltan.join(', ')}`); return; }

    const payload = isTransfer
      ? {
          tipoOperacion: 'transferencia' as const,
          conceptoId, fecha,
          cuentaId, cuentaDestinoId,
          monto: Number(monto),
          moneda: cuentaOrigen!.moneda,
          montoDestino: montoDestino ? Number(montoDestino) : (requiereMontoDestino ? 0 : Number(monto)),
          cotizacionUsd: cotizacion ? Number(cotizacion) : null,
          descripcion: descripcion.trim() || null,
          numeroComprobante: numeroComprobante.trim() || null,
          comprobanteUrl: null,
          esNoRecuperable,
        }
      : {
          tipoOperacion: tipoOp as 'entrada' | 'salida',
          conceptoId, fecha,
          cuentaId,
          monto: Number(monto),
          moneda: cuentaOrigen?.moneda ?? 'ARS' as const,
          cotizacionUsd: cotizacion ? Number(cotizacion) : null,
          parteOrigenId: parteOrigenId || null,
          parteDestinoId: parteDestinoId || null,
          obraId: obraId || null,
          proveedorId: proveedorId || null,
          rubroId: null,
          descripcion: descripcion.trim() || null,
          numeroComprobante: numeroComprobante.trim() || null,
          comprobanteUrl: null,
          esNoRecuperable,
        };

    startTransition(async () => {
      const r = edit
        ? await editarMovimiento(edit.id, payload, edit.version)
        : await crearMovimiento(payload);
      if (r.ok) {
        toast.success(edit ? 'Movimiento actualizado' : 'Movimiento creado');
        router.push(edit ? `/movimientos/${edit.id}` : '/movimientos');
        router.refresh();
      } else {
        setErrorMsg(r.error);
        toast.error(r.error);
      }
    });
  }

  // Keyboard: Esc cancela, Enter avanza (si no estamos editando un campo multi-line).
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        router.push('/movimientos');
      } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        handleAvanzar();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, tipoOp, conceptoId, cuentaId, cuentaDestinoId, monto, montoDestino, obraId, proveedorId]);

  const previewData = {
    tipoOperacion: tipoOp,
    conceptoNombre: concepto?.nombre ?? null,
    conceptoCodigo: concepto?.codigo ?? null,
    fecha,
    cuentaNombre: cuentaOrigen?.nombre ?? null,
    cuentaMoneda: cuentaOrigen?.moneda ?? null,
    cuentaDestinoNombre: cuentaDestino?.nombre ?? null,
    cuentaDestinoMoneda: cuentaDestino?.moneda ?? null,
    monto, montoDestino, cotizacion,
    obraNombre: obras.find((o) => o.id === obraId)?.nombre ?? null,
    obraCodigo: obras.find((o) => o.id === obraId)?.codigo ?? null,
    proveedorNombre: proveedores.find((p) => p.id === proveedorId)?.nombre ?? null,
    parteNombre: partes.find((p) => p.id === (parteOrigenId || parteDestinoId))?.nombre ?? null,
    descripcion, numeroComprobante, esNoRecuperable,
  };

  return (
    <>
      <Toaster />

      <StepperHeader step={step} onJumpBack={(s) => setStep(s)} hideStep1={isEdit} />

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6 mt-6">
        <div>
          {step === 1 && (
            <Step1Tipo
              elegir={elegirTipo}
              actual={tipoOp}
              hayConceptosPorTipo={{
                entrada: conceptos.some((c) => c.tipo === 'ingreso'),
                salida: conceptos.some((c) => c.tipo === 'egreso'),
                transferencia: conceptos.some((c) => c.tipo === 'transferencia'),
              }}
            />
          )}

          {step === 2 && (
            <Step2Datos
              tipoOp={tipoOp!}
              conceptos={conceptosFiltrados}
              conceptoId={conceptoId}
              setConceptoId={setConceptoId}
              conceptoSearch={conceptoSearch}
              setConceptoSearch={setConceptoSearch}
              concepto={concepto ?? null}
              fecha={fecha}
              setFecha={setFecha}
              cuentas={cuentas}
              cuentaId={cuentaId}
              setCuentaId={setCuentaId}
              cuentaDestinoId={cuentaDestinoId}
              setCuentaDestinoId={setCuentaDestinoId}
              cuentaOrigen={cuentaOrigen ?? null}
              cuentaDestino={cuentaDestino ?? null}
              monto={monto}
              setMonto={setMonto}
              montoDestino={montoDestino}
              setMontoDestino={setMontoDestino}
              cotizacion={cotizacion}
              setCotizacion={setCotizacion}
              requiereMontoDestino={requiereMontoDestino}
            />
          )}

          {step === 3 && (
            <Step3Detalles
              tipoOp={tipoOp!}
              concepto={concepto!}
              obras={obras}
              obraId={obraId}
              setObraId={setObraId}
              partes={partes}
              parteOrigenId={parteOrigenId}
              setParteOrigenId={setParteOrigenId}
              parteDestinoId={parteDestinoId}
              setParteDestinoId={setParteDestinoId}
              proveedores={proveedores}
              proveedorId={proveedorId}
              setProveedorId={setProveedorId}
              descripcion={descripcion}
              setDescripcion={setDescripcion}
              numeroComprobante={numeroComprobante}
              setNumeroComprobante={setNumeroComprobante}
              esNoRecuperable={esNoRecuperable}
              setEsNoRecuperable={setEsNoRecuperable}
            />
          )}

          {errorMsg && (
            <div className="mt-4 rounded-lg border border-red-300 bg-red-50 text-red-800 px-4 py-3 text-[13px] flex items-start gap-2">
              <AlertCircle className="size-4 shrink-0 mt-0.5" aria-hidden />
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="mt-6 flex items-center justify-between gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={
                // En edición no se vuelve al paso 1 (no se puede cambiar tipo).
                (step === 1 || (step === 2 && isEdit))
                  ? () => router.push(isEdit && edit ? `/movimientos/${edit.id}` : '/movimientos')
                  : handleVolver
              }
              disabled={pending}
            >
              {(step === 1 || (step === 2 && isEdit)) ? (
                <><X className="size-4 mr-1" aria-hidden />Cancelar</>
              ) : (
                <><ChevronLeft className="size-4 mr-1" aria-hidden />Volver</>
              )}
            </Button>
            {step < 3 ? (
              <Button
                type="button"
                onClick={handleAvanzar}
                disabled={pending || (step === 1 && !tipoOp) || (step === 2 && !step2Valido().ok)}
              >
                Continuar
                <ChevronRight className="size-4 ml-1" aria-hidden />
              </Button>
            ) : (
              <Button type="button" onClick={handleSubmit} disabled={pending || missingRequired.length > 0}>
                <Save className="size-4 mr-1" aria-hidden />
                {pending ? 'Guardando…' : (isEdit ? 'Guardar cambios' : 'Guardar movimiento')}
              </Button>
            )}
          </div>
        </div>

        <div className="hidden lg:block">
          <MovimientoPreview data={previewData} missingRequired={missingRequired} />
        </div>
      </div>
    </>
  );
}

// ----------------- Sub-componentes -----------------

function StepperHeader({
  step, onJumpBack, hideStep1 = false,
}: { step: 1 | 2 | 3; onJumpBack: (s: 1 | 2 | 3) => void; hideStep1?: boolean }) {
  const allSteps = [
    { n: 1, label: 'Tipo' },
    { n: 2, label: 'Datos' },
    { n: 3, label: 'Detalles' },
  ] as const;
  const steps = hideStep1 ? allSteps.slice(1) : allSteps;
  return (
    <ol className="flex items-center gap-3">
      {steps.map((s, i) => {
        const isActive = step === s.n;
        const isDone = step > s.n;
        const canClick = isDone;
        const Element = canClick ? 'button' : 'div';
        return (
          <li key={s.n} className="flex items-center gap-3 flex-1">
            <Element
              type={canClick ? 'button' : undefined}
              onClick={canClick ? () => onJumpBack(s.n as 1 | 2 | 3) : undefined}
              className={cn(
                'flex items-center gap-2.5',
                canClick && 'hover:text-foreground transition-colors',
              )}
            >
              <span className={cn(
                'flex size-7 items-center justify-center rounded-full text-[12px] font-semibold border-2 transition-colors',
                isActive && 'border-primary bg-primary text-primary-foreground',
                isDone && 'border-primary bg-primary text-primary-foreground',
                !isActive && !isDone && 'border-muted-foreground/30 text-muted-foreground',
              )}>
                {isDone ? <Check className="size-3.5" /> : s.n}
              </span>
              <span className={cn(
                'text-[13px] font-medium',
                (isActive || isDone) ? 'text-foreground' : 'text-muted-foreground',
              )}>
                {s.label}
              </span>
            </Element>
            {i < steps.length - 1 && (
              <span className={cn(
                'flex-1 h-px',
                isDone ? 'bg-primary' : 'bg-muted-foreground/20',
              )} />
            )}
          </li>
        );
      })}
    </ol>
  );
}

function Step1Tipo({
  elegir, actual, hayConceptosPorTipo,
}: {
  elegir: (t: TipoOp) => void;
  actual: TipoOp | null;
  hayConceptosPorTipo: Record<TipoOp, boolean>;
}) {
  return (
    <div className="rounded-xl border bg-card p-6 shadow-[0_1px_2px_rgba(16,24,40,0.04),0_1px_3px_rgba(16,24,40,0.06)]">
      <h2 className="text-[15px] font-semibold mb-1">¿Qué tipo de movimiento querés cargar?</h2>
      <p className="text-[13px] text-muted-foreground mb-5">
        Hacé click en una opción para avanzar al siguiente paso.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {(['entrada', 'salida', 'transferencia'] as TipoOp[]).map((t) => {
          const meta = TIPO_META[t];
          const disabled = !hayConceptosPorTipo[t];
          const isSelected = actual === t;
          return (
            <button
              key={t}
              type="button"
              onClick={() => !disabled && elegir(t)}
              disabled={disabled}
              className={cn(
                'rounded-xl border-2 p-5 text-left transition-all',
                isSelected ? `${meta.bg} ${meta.border}` : 'bg-card border-border',
                !isSelected && !disabled && `${meta.hoverBg} ${meta.hoverBorder} hover:scale-[1.01]`,
                disabled && 'opacity-50 cursor-not-allowed',
              )}
            >
              <span className={cn(
                'flex size-10 items-center justify-center rounded-lg mb-3',
                meta.bg, meta.text,
              )}>
                <meta.Icon className="size-5" aria-hidden />
              </span>
              <div className={cn('text-[15px] font-semibold', isSelected && meta.text)}>{meta.label}</div>
              <div className="text-[12px] text-muted-foreground mt-1 leading-snug">{meta.desc}</div>
              {disabled && (
                <div className="text-[11px] text-muted-foreground mt-2 italic">
                  Sin conceptos configurados
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Step2Datos({
  tipoOp, conceptos, conceptoId, setConceptoId, conceptoSearch, setConceptoSearch, concepto,
  fecha, setFecha,
  cuentas, cuentaId, setCuentaId, cuentaDestinoId, setCuentaDestinoId,
  cuentaOrigen, cuentaDestino,
  monto, setMonto, montoDestino, setMontoDestino, cotizacion, setCotizacion,
  requiereMontoDestino,
}: {
  tipoOp: TipoOp;
  conceptos: Concepto[];
  conceptoId: string;
  setConceptoId: (v: string) => void;
  conceptoSearch: string;
  setConceptoSearch: (v: string) => void;
  concepto: Concepto | null;
  fecha: string;
  setFecha: (v: string) => void;
  cuentas: Cuenta[];
  cuentaId: string;
  setCuentaId: (v: string) => void;
  cuentaDestinoId: string;
  setCuentaDestinoId: (v: string) => void;
  cuentaOrigen: Cuenta | null;
  cuentaDestino: Cuenta | null;
  monto: string;
  setMonto: (v: string) => void;
  montoDestino: string;
  setMontoDestino: (v: string) => void;
  cotizacion: string;
  setCotizacion: (v: string) => void;
  requiereMontoDestino: boolean;
}) {
  const isTransfer = tipoOp === 'transferencia';
  const isIngreso = tipoOp === 'entrada';

  return (
    <div className="space-y-4">
      <div className="rounded-xl border bg-card p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04),0_1px_3px_rgba(16,24,40,0.06)]">
        <h3 className="text-[14px] font-semibold mb-1">Concepto</h3>
        <p className="text-[12px] text-muted-foreground mb-3">
          Categoría que define qué tipo de movimiento es y qué campos exige.
        </p>
        <div className="relative mb-3">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" aria-hidden />
          <Input
            placeholder="Buscar por código o nombre…"
            value={conceptoSearch}
            onChange={(e) => setConceptoSearch(e.target.value)}
            className="pl-8 h-8 text-[13px]"
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[280px] overflow-y-auto pr-1">
          {conceptos.length === 0 ? (
            <div className="col-span-full text-[13px] text-muted-foreground text-center py-4">
              No hay conceptos {conceptoSearch ? 'que coincidan' : 'disponibles'}.
            </div>
          ) : conceptos.map((c) => {
            const isSelected = c.id === conceptoId;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => setConceptoId(c.id)}
                className={cn(
                  'rounded-lg border px-3 py-2.5 text-left transition-all',
                  isSelected
                    ? 'border-primary bg-primary/5 ring-1 ring-primary/30'
                    : 'border-border hover:border-foreground/30 hover:bg-secondary/40',
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-[10.5px] text-muted-foreground">{c.codigo}</span>
                  {(c.requiereObra || c.requiereProveedor || c.esNoRecuperable) && (
                    <div className="flex gap-1">
                      {c.requiereObra && <Badge variant="outline" className="text-[9.5px] py-0 px-1 h-4 font-normal">obra</Badge>}
                      {c.requiereProveedor && <Badge variant="outline" className="text-[9.5px] py-0 px-1 h-4 font-normal">prov</Badge>}
                      {c.esNoRecuperable && <Badge variant="outline" className="text-[9.5px] py-0 px-1 h-4 font-normal border-orange-300 bg-orange-50 text-orange-800">no rec</Badge>}
                    </div>
                  )}
                </div>
                <div className="text-[13px] font-medium leading-tight mt-0.5">{c.nombre}</div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="rounded-xl border bg-card p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04),0_1px_3px_rgba(16,24,40,0.06)] space-y-4">
        <div className="grid grid-cols-[160px_1fr] gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="step2-fecha">Fecha</Label>
            <Input id="step2-fecha" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="step2-cuenta">
              {isTransfer ? 'Cuenta origen' : (isIngreso ? 'Cuenta donde entra' : 'Cuenta de donde sale')}
            </Label>
            <Select value={cuentaId} onValueChange={(v) => setCuentaId(v ?? '')}>
              <SelectTrigger id="step2-cuenta"><SelectValue placeholder="Elegí cuenta…" /></SelectTrigger>
              <SelectContent>
                {cuentas.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.nombre} <span className="text-muted-foreground text-[11px] ml-1">({c.moneda})</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {isTransfer && (
          <div className="grid grid-cols-[160px_1fr] gap-3">
            <div /> {/* spacer */}
            <div className="grid gap-1.5">
              <Label htmlFor="step2-cuenta-destino">Cuenta destino</Label>
              <Select value={cuentaDestinoId} onValueChange={(v) => setCuentaDestinoId(v ?? '')}>
                <SelectTrigger id="step2-cuenta-destino"><SelectValue placeholder="Elegí cuenta destino…" /></SelectTrigger>
                <SelectContent>
                  {cuentas.filter((c) => c.id !== cuentaId).map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.nombre} <span className="text-muted-foreground text-[11px] ml-1">({c.moneda})</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        <div className="grid grid-cols-[1fr_120px_140px] gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="step2-monto">
              {isTransfer ? `Monto que sale ${cuentaOrigen ? `(${cuentaOrigen.moneda})` : ''}` : `Monto ${cuentaOrigen ? `(${cuentaOrigen.moneda})` : ''}`}
            </Label>
            <Input
              id="step2-monto"
              type="number"
              step="0.01"
              min="0"
              value={monto}
              onChange={(e) => setMonto(e.target.value)}
              placeholder="0.00"
              className="font-mono tabular-nums"
              autoFocus={!!conceptoId && !!cuentaId}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="step2-moneda">Moneda</Label>
            <Input
              id="step2-moneda"
              value={cuentaOrigen?.moneda ?? '—'}
              disabled
              className="font-mono"
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="step2-cotizacion">
              Cotización USD <span className="text-muted-foreground font-normal text-[11px]">(opc.)</span>
            </Label>
            <Input
              id="step2-cotizacion"
              type="number"
              step="0.01"
              min="0"
              value={cotizacion}
              onChange={(e) => setCotizacion(e.target.value)}
              placeholder="—"
              className="font-mono tabular-nums"
            />
          </div>
        </div>

        {requiereMontoDestino && (
          <div className="grid grid-cols-[1fr_180px] gap-3 items-end rounded-lg bg-blue-50 border border-blue-200 p-3">
            <div className="grid gap-1.5">
              <Label htmlFor="step2-monto-destino" className="text-[12px]">
                Monto que entra ({cuentaDestino?.moneda})
              </Label>
              <Input
                id="step2-monto-destino"
                type="number"
                step="0.01"
                min="0"
                value={montoDestino}
                onChange={(e) => setMontoDestino(e.target.value)}
                placeholder="0.00"
                className="font-mono tabular-nums"
              />
            </div>
            <div className="text-[12px] text-blue-700 pb-2">
              {monto && montoDestino && Number(monto) > 0 && (
                <span className="font-mono">
                  TC implícito: {(Number(montoDestino) / Number(monto)).toFixed(2)}
                </span>
              )}
            </div>
          </div>
        )}

        {concepto && (
          <div className="text-[12px] text-muted-foreground pt-1">
            Concepto seleccionado: <span className="font-medium text-foreground">{concepto.nombre}</span>
            {(concepto.requiereObra || concepto.requiereProveedor) && (
              <span className="ml-2">— en el próximo paso te pediremos: {[
                concepto.requiereObra && 'obra',
                concepto.requiereProveedor && 'proveedor',
              ].filter(Boolean).join(', ')}</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Step3Detalles({
  tipoOp, concepto,
  obras, obraId, setObraId,
  partes, parteOrigenId, setParteOrigenId, parteDestinoId, setParteDestinoId,
  proveedores, proveedorId, setProveedorId,
  descripcion, setDescripcion,
  numeroComprobante, setNumeroComprobante,
  esNoRecuperable, setEsNoRecuperable,
}: {
  tipoOp: TipoOp;
  concepto: Concepto;
  obras: ObraOption[];
  obraId: string;
  setObraId: (v: string) => void;
  partes: ParteOption[];
  parteOrigenId: string;
  setParteOrigenId: (v: string) => void;
  parteDestinoId: string;
  setParteDestinoId: (v: string) => void;
  proveedores: ProveedorOption[];
  proveedorId: string;
  setProveedorId: (v: string) => void;
  descripcion: string;
  setDescripcion: (v: string) => void;
  numeroComprobante: string;
  setNumeroComprobante: (v: string) => void;
  esNoRecuperable: boolean;
  setEsNoRecuperable: (v: boolean) => void;
}) {
  const isTransfer = tipoOp === 'transferencia';
  const isIngreso = tipoOp === 'entrada';
  const partesNoObra = partes.filter((p) => p.tipo !== 'obra' && p.tipo !== 'proveedor');

  return (
    <div className="space-y-4">
      {!isTransfer && (
        <div className="rounded-xl border bg-card p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04),0_1px_3px_rgba(16,24,40,0.06)] space-y-4">
          <h3 className="text-[14px] font-semibold">Asociaciones</h3>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="step3-obra">
                Obra {concepto.requiereObra ? <span className="text-red-600">*</span> : <span className="text-muted-foreground font-normal text-[11px]">(opc.)</span>}
              </Label>
              <Select value={obraId || '__none__'} onValueChange={(v) => setObraId(!v || v === '__none__' ? '' : v)}>
                <SelectTrigger id="step3-obra"><SelectValue placeholder="Elegí obra…" /></SelectTrigger>
                <SelectContent>
                  {!concepto.requiereObra && <SelectItem value="__none__">— sin obra —</SelectItem>}
                  {obras.map((o) => (
                    <SelectItem key={o.id} value={o.id}>
                      <span className="font-mono text-[11px] text-muted-foreground mr-1.5">{o.codigo}</span>
                      {o.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {isIngreso ? (
              <div className="grid gap-1.5">
                <Label htmlFor="step3-parte-origen">
                  ¿De quién entra? <span className="text-muted-foreground font-normal text-[11px]">(opc.)</span>
                </Label>
                <Select value={parteOrigenId || '__none__'} onValueChange={(v) => setParteOrigenId(!v || v === '__none__' ? '' : v)}>
                  <SelectTrigger id="step3-parte-origen"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">— sin asignar —</SelectItem>
                    {partesNoObra.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.nombre} <span className="text-muted-foreground text-[11px] ml-1">({p.tipo})</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div className="grid gap-1.5">
                <Label htmlFor="step3-parte-destino">
                  ¿A quién va? <span className="text-muted-foreground font-normal text-[11px]">(opc.)</span>
                </Label>
                <Select value={parteDestinoId || '__none__'} onValueChange={(v) => setParteDestinoId(!v || v === '__none__' ? '' : v)}>
                  <SelectTrigger id="step3-parte-destino"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">— sin asignar —</SelectItem>
                    {partesNoObra.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.nombre} <span className="text-muted-foreground text-[11px] ml-1">({p.tipo})</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {concepto.requiereProveedor && (
            <div className="grid gap-1.5">
              <Label htmlFor="step3-proveedor">Proveedor <span className="text-red-600">*</span></Label>
              <Select value={proveedorId} onValueChange={(v) => setProveedorId(v ?? '')}>
                <SelectTrigger id="step3-proveedor"><SelectValue placeholder="Elegí proveedor…" /></SelectTrigger>
                <SelectContent>
                  {proveedores.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.nombre}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {proveedores.length === 0 && (
                <p className="text-[12px] text-muted-foreground">
                  No hay proveedores cargados. Pedile a un admin que cree el proveedor primero.
                </p>
              )}
            </div>
          )}
        </div>
      )}

      <div className="rounded-xl border bg-card p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04),0_1px_3px_rgba(16,24,40,0.06)] space-y-4">
        <h3 className="text-[14px] font-semibold">Comprobante y notas</h3>

        <div className="grid grid-cols-[180px_1fr] gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="step3-numero">
              N° comprobante <span className="text-muted-foreground font-normal text-[11px]">(opc.)</span>
            </Label>
            <Input
              id="step3-numero"
              value={numeroComprobante}
              onChange={(e) => setNumeroComprobante(e.target.value)}
              placeholder="FC-0001-…"
              className="font-mono"
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="step3-descripcion">
              Descripción <span className="text-muted-foreground font-normal text-[11px]">(opc.)</span>
            </Label>
            <Input
              id="step3-descripcion"
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              placeholder="Detalles del movimiento"
            />
          </div>
        </div>

        {!isTransfer && (
          <label className="flex items-center gap-2.5 text-[13px]">
            <Checkbox
              checked={esNoRecuperable}
              onCheckedChange={(v) => setEsNoRecuperable(v === true)}
              disabled={concepto.esNoRecuperable}
            />
            <span>
              Es un gasto no recuperable (lo absorbe la empresa, no se cobra al cliente)
              {concepto.esNoRecuperable && (
                <span className="text-muted-foreground italic ml-1">— el concepto ya lo marca por defecto</span>
              )}
            </span>
          </label>
        )}
      </div>
    </div>
  );
}
