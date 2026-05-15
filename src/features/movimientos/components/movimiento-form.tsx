'use client';

import { useState, useTransition, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowDownToLine, ArrowUpFromLine, ArrowLeftRight, Save, X, AlertCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup, SelectLabel,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { Toaster } from '@/components/ui/sonner';
import { cn } from '@/lib/utils';
import { crearMovimiento } from '../actions';

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

type Props = {
  conceptos: Concepto[];
  cuentas: Cuenta[];
  obras: ObraOption[];
  partes: ParteOption[];
  proveedores: ProveedorOption[];
};

const TIPO_ICON = {
  ingreso: ArrowDownToLine,
  egreso: ArrowUpFromLine,
  transferencia: ArrowLeftRight,
};

const TIPO_LABEL = {
  ingreso: 'Ingreso',
  egreso: 'Egreso',
  transferencia: 'Transferencia',
};

export function MovimientoForm({ conceptos, cuentas, obras, partes, proveedores }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const todayIso = new Date().toISOString().slice(0, 10);

  // Estado del form
  const [conceptoId, setConceptoId] = useState<string>('');
  const [fecha, setFecha] = useState(todayIso);
  const [cuentaId, setCuentaId] = useState<string>('');
  const [cuentaDestinoId, setCuentaDestinoId] = useState<string>('');
  const [monto, setMonto] = useState<string>('');
  const [montoDestino, setMontoDestino] = useState<string>('');
  const [moneda, setMoneda] = useState<'USD' | 'ARS'>('ARS');
  const [cotizacion, setCotizacion] = useState<string>('');
  const [obraId, setObraId] = useState<string>('');
  const [proveedorId, setProveedorId] = useState<string>('');
  const [parteOrigenId, setParteOrigenId] = useState<string>('');
  const [parteDestinoId, setParteDestinoId] = useState<string>('');
  const [descripcion, setDescripcion] = useState<string>('');
  const [numeroComprobante, setNumeroComprobante] = useState<string>('');
  const [esNoRecuperable, setEsNoRecuperable] = useState(false);

  const concepto = useMemo(
    () => conceptos.find((c) => c.id === conceptoId),
    [conceptoId, conceptos],
  );

  const cuentaOrigen = useMemo(
    () => cuentas.find((c) => c.id === cuentaId),
    [cuentaId, cuentas],
  );

  const cuentaDestino = useMemo(
    () => cuentas.find((c) => c.id === cuentaDestinoId),
    [cuentaDestinoId, cuentas],
  );

  const isTransfer = concepto?.tipo === 'transferencia';
  const isIngreso = concepto?.tipo === 'ingreso';
  const requiereMontoDestino = isTransfer && cuentaOrigen && cuentaDestino &&
    cuentaOrigen.moneda !== cuentaDestino.moneda;

  // Cuando cambia la cuenta origen, autocompletar la moneda.
  function handleCuentaOrigenChange(id: string) {
    setCuentaId(id);
    const c = cuentas.find((x) => x.id === id);
    if (c) setMoneda(c.moneda);
  }

  function handleConceptoChange(id: string) {
    setConceptoId(id);
    const c = conceptos.find((x) => x.id === id);
    if (c?.esNoRecuperable) setEsNoRecuperable(true);
  }

  function buildPayload() {
    if (!concepto) throw new Error('Concepto no elegido');
    if (isTransfer) {
      return {
        tipoOperacion: 'transferencia' as const,
        conceptoId,
        fecha,
        cuentaId,
        cuentaDestinoId,
        monto: Number(monto),
        moneda: cuentaOrigen?.moneda ?? moneda,
        montoDestino: montoDestino ? Number(montoDestino) : (requiereMontoDestino ? 0 : Number(monto)),
        cotizacionUsd: cotizacion ? Number(cotizacion) : null,
        descripcion: descripcion.trim() || null,
        numeroComprobante: numeroComprobante.trim() || null,
        comprobanteUrl: null,
        esNoRecuperable,
      };
    }
    return {
      tipoOperacion: (isIngreso ? 'entrada' : 'salida') as 'entrada' | 'salida',
      conceptoId,
      fecha,
      cuentaId,
      monto: Number(monto),
      moneda,
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
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);
    if (!concepto) {
      setErrorMsg('Elegí un concepto');
      return;
    }
    if (!cuentaId) {
      setErrorMsg('Elegí la cuenta');
      return;
    }
    if (isTransfer && !cuentaDestinoId) {
      setErrorMsg('Elegí la cuenta destino');
      return;
    }
    if (!monto || Number(monto) <= 0) {
      setErrorMsg('Ingresá un monto positivo');
      return;
    }
    if (requiereMontoDestino && (!montoDestino || Number(montoDestino) <= 0)) {
      setErrorMsg('Transferencia de moneda distinta: completá el monto destino');
      return;
    }
    if (concepto.requiereObra && !obraId) {
      setErrorMsg(`El concepto "${concepto.nombre}" requiere asignar una obra`);
      return;
    }
    if (concepto.requiereProveedor && !proveedorId) {
      setErrorMsg(`El concepto "${concepto.nombre}" requiere asignar un proveedor`);
      return;
    }

    const payload = buildPayload();
    startTransition(async () => {
      const r = await crearMovimiento(payload);
      if (r.ok) {
        toast.success('Movimiento creado');
        router.push('/movimientos');
        router.refresh();
      } else {
        setErrorMsg(r.error);
        toast.error(r.error);
      }
    });
  }

  // Agrupar conceptos por tipo para el select.
  const conceptosPorTipo = useMemo(() => {
    const groups: Record<string, Concepto[]> = { ingreso: [], egreso: [], transferencia: [] };
    for (const c of conceptos) groups[c.tipo].push(c);
    return groups;
  }, [conceptos]);

  // Partes filtradas para origen (ingresos) vs destino (egresos).
  // Las partes tipo "obra" aparecen también, pero en MVP usamos obra_id por separado.
  const partesNoObra = useMemo(() => partes.filter((p) => p.tipo !== 'obra' && p.tipo !== 'proveedor'), [partes]);

  return (
    <>
      <Toaster />
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Selector de concepto */}
        <div className="rounded-xl border bg-card p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04),0_1px_3px_rgba(16,24,40,0.06)]">
          <div className="grid gap-1.5">
            <Label htmlFor="mov-concepto" className="text-[13px] font-semibold">¿Qué tipo de movimiento es?</Label>
            <Select value={conceptoId} onValueChange={(v) => handleConceptoChange(v ?? '')}>
              <SelectTrigger id="mov-concepto">
                <SelectValue placeholder="Elegí un concepto…" />
              </SelectTrigger>
              <SelectContent>
                {(['ingreso', 'egreso', 'transferencia'] as const).map((tipo) => {
                  const items = conceptosPorTipo[tipo];
                  if (items.length === 0) return null;
                  const Icon = TIPO_ICON[tipo];
                  return (
                    <SelectGroup key={tipo}>
                      <SelectLabel className="flex items-center gap-1.5">
                        <Icon className="size-3" aria-hidden />
                        {TIPO_LABEL[tipo]}s
                      </SelectLabel>
                      {items.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          <span className="font-mono text-[11px] text-muted-foreground mr-2">{c.codigo}</span>
                          {c.nombre}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  );
                })}
              </SelectContent>
            </Select>
            {concepto && (
              <div className="mt-1 text-[12px] text-muted-foreground">
                {concepto.requiereObra && <span className="mr-2">• Requiere obra</span>}
                {concepto.requiereProveedor && <span className="mr-2">• Requiere proveedor</span>}
                {concepto.esNoRecuperable && <span className="text-orange-700">• Marcado como no recuperable</span>}
              </div>
            )}
          </div>
        </div>

        {concepto && (
          <>
            {/* Fecha + Cuenta(s) + Monto(s) */}
            <div className="rounded-xl border bg-card p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04),0_1px_3px_rgba(16,24,40,0.06)] space-y-4">
              <div className="grid grid-cols-[180px_1fr] gap-3">
                <div className="grid gap-1.5">
                  <Label htmlFor="mov-fecha">Fecha</Label>
                  <Input
                    id="mov-fecha"
                    type="date"
                    value={fecha}
                    onChange={(e) => setFecha(e.target.value)}
                    required
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="mov-cuenta">
                    {isTransfer ? 'Cuenta origen' : (isIngreso ? 'Cuenta donde entra' : 'Cuenta de donde sale')}
                  </Label>
                  <Select value={cuentaId} onValueChange={(v) => handleCuentaOrigenChange(v ?? '')}>
                    <SelectTrigger id="mov-cuenta"><SelectValue placeholder="Elegí cuenta…" /></SelectTrigger>
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
                <div className="grid grid-cols-2 gap-3">
                  <div className="grid gap-1.5">
                    <Label htmlFor="mov-cuenta-destino">Cuenta destino</Label>
                    <Select value={cuentaDestinoId} onValueChange={(v) => setCuentaDestinoId(v ?? '')}>
                      <SelectTrigger id="mov-cuenta-destino"><SelectValue placeholder="Elegí cuenta destino…" /></SelectTrigger>
                      <SelectContent>
                        {cuentas
                          .filter((c) => c.id !== cuentaId)
                          .map((c) => (
                            <SelectItem key={c.id} value={c.id}>
                              {c.nombre} <span className="text-muted-foreground text-[11px] ml-1">({c.moneda})</span>
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div />
                </div>
              )}

              <div className="grid grid-cols-[1fr_120px_140px] gap-3">
                <div className="grid gap-1.5">
                  <Label htmlFor="mov-monto">
                    {isTransfer ? 'Monto que sale' : 'Monto'}
                  </Label>
                  <Input
                    id="mov-monto"
                    type="number"
                    step="0.01"
                    min="0"
                    value={monto}
                    onChange={(e) => setMonto(e.target.value)}
                    placeholder="0.00"
                    className="font-mono tabular-nums"
                    required
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="mov-moneda">Moneda</Label>
                  <Select
                    value={moneda}
                    onValueChange={(v) => setMoneda(v as 'USD' | 'ARS')}
                    disabled={isTransfer}
                  >
                    <SelectTrigger id="mov-moneda"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ARS">ARS</SelectItem>
                      <SelectItem value="USD">USD</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="mov-cotizacion">
                    Cotización USD <span className="text-muted-foreground font-normal">(opc.)</span>
                  </Label>
                  <Input
                    id="mov-cotizacion"
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
                <div className="grid grid-cols-[1fr_140px_1fr] gap-3 items-end rounded-lg bg-blue-50 border border-blue-200 p-3">
                  <div className="grid gap-1.5">
                    <Label htmlFor="mov-monto-destino" className="text-[12px]">
                      Monto que entra <span className="text-muted-foreground font-normal">({cuentaDestino?.moneda})</span>
                    </Label>
                    <Input
                      id="mov-monto-destino"
                      type="number"
                      step="0.01"
                      min="0"
                      value={montoDestino}
                      onChange={(e) => setMontoDestino(e.target.value)}
                      placeholder="0.00"
                      className="font-mono tabular-nums"
                      required
                    />
                  </div>
                  <div className="text-[12px] text-blue-700 pb-2 text-center">
                    Cambio entre monedas
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
            </div>

            {/* Origen/Destino y obra/proveedor (no para transferencias) */}
            {!isTransfer && (
              <div className="rounded-xl border bg-card p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04),0_1px_3px_rgba(16,24,40,0.06)] space-y-4">
                <div className="text-[12px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                  Detalles
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {isIngreso ? (
                    <div className="grid gap-1.5">
                      <Label htmlFor="mov-parte-origen">
                        ¿De quién entra? <span className="text-muted-foreground font-normal">(opc.)</span>
                      </Label>
                      <Select value={parteOrigenId || '__none__'} onValueChange={(v) => setParteOrigenId(v === '__none__' || v == null ? '' : v)}>
                        <SelectTrigger id="mov-parte-origen"><SelectValue /></SelectTrigger>
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
                      <Label htmlFor="mov-parte-destino">
                        ¿A quién va? <span className="text-muted-foreground font-normal">(opc.)</span>
                      </Label>
                      <Select value={parteDestinoId || '__none__'} onValueChange={(v) => setParteDestinoId(v === '__none__' || v == null ? '' : v)}>
                        <SelectTrigger id="mov-parte-destino"><SelectValue /></SelectTrigger>
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

                  <div className="grid gap-1.5">
                    <Label htmlFor="mov-obra">
                      Obra {concepto.requiereObra && <span className="text-red-600">*</span>}
                      {!concepto.requiereObra && <span className="text-muted-foreground font-normal"> (opc.)</span>}
                    </Label>
                    <Select value={obraId || '__none__'} onValueChange={(v) => setObraId(v === '__none__' || v == null ? '' : v)}>
                      <SelectTrigger id="mov-obra"><SelectValue /></SelectTrigger>
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
                </div>

                {concepto.requiereProveedor && (
                  <div className="grid gap-1.5">
                    <Label htmlFor="mov-proveedor">
                      Proveedor <span className="text-red-600">*</span>
                    </Label>
                    <Select value={proveedorId} onValueChange={(v) => setProveedorId(v ?? '')}>
                      <SelectTrigger id="mov-proveedor"><SelectValue placeholder="Elegí proveedor…" /></SelectTrigger>
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

            {/* Descripción + comprobante + flags */}
            <div className="rounded-xl border bg-card p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04),0_1px_3px_rgba(16,24,40,0.06)] space-y-4">
              <div className="grid grid-cols-[1fr_180px] gap-3">
                <div className="grid gap-1.5">
                  <Label htmlFor="mov-descripcion">
                    Descripción <span className="text-muted-foreground font-normal">(opc.)</span>
                  </Label>
                  <Input
                    id="mov-descripcion"
                    value={descripcion}
                    onChange={(e) => setDescripcion(e.target.value)}
                    placeholder="Texto libre"
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="mov-comprobante-nro">
                    N° comprobante <span className="text-muted-foreground font-normal">(opc.)</span>
                  </Label>
                  <Input
                    id="mov-comprobante-nro"
                    value={numeroComprobante}
                    onChange={(e) => setNumeroComprobante(e.target.value)}
                    placeholder="FC-0001-…"
                    className="font-mono"
                  />
                </div>
              </div>
              {!isTransfer && (
                <label className="flex items-center gap-2.5 text-[13.5px]">
                  <Checkbox
                    checked={esNoRecuperable}
                    onCheckedChange={(v) => setEsNoRecuperable(v === true)}
                  />
                  Es un gasto no recuperable (lo absorbe la empresa, no se cobra al cliente)
                </label>
              )}
            </div>

            {errorMsg && (
              <div className="rounded-lg border border-red-300 bg-red-50 text-red-800 px-4 py-3 text-[13px] flex items-start gap-2">
                <AlertCircle className="size-4 shrink-0 mt-0.5" aria-hidden />
                <span>{errorMsg}</span>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => router.push('/movimientos')} disabled={pending}>
                <X className="size-4 mr-1" aria-hidden />
                Cancelar
              </Button>
              <Button type="submit" disabled={pending}>
                <Save className="size-4 mr-1" aria-hidden />
                {pending ? 'Guardando…' : 'Guardar movimiento'}
              </Button>
            </div>
          </>
        )}
      </form>
    </>
  );
}
