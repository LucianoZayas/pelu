'use client';

import { useState, useTransition, useMemo, useRef, useEffect } from 'react';
import { Save, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { toast } from 'sonner';
import { Toaster } from '@/components/ui/sonner';
import { formatMoney } from '@/lib/format';
import { cn } from '@/lib/utils';
import { actualizarAvance } from '../actions';
import type { AvanceRow } from '../queries';

type Props = {
  certId: string;
  moneda: 'USD' | 'ARS';
  avances: AvanceRow[];
  readonly: boolean;
};

// Form de avance editable. Mientras el admin tipea en una celda, calculamos
// los montos en el cliente para preview. Al perder el foco (o al apretar
// "Guardar avance"), enviamos al server vía actualizarAvance.
export function AvanceEditor({ certId, moneda, avances, readonly }: Props) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);

  // Estado local: porcentaje_acumulado por itemId.
  const [local, setLocal] = useState<Record<string, string>>(() => {
    const m: Record<string, string> = {};
    for (const a of avances) m[a.itemPresupuestoId] = a.porcentajeAcumulado;
    return m;
  });
  const initialRef = useRef(local);

  // Detectar si algo cambió respecto al estado inicial.
  const dirty = useMemo(() => {
    return avances.some((a) => local[a.itemPresupuestoId] !== initialRef.current[a.itemPresupuestoId]);
  }, [local, avances]);

  // Cálculos locales en vivo para preview.
  const filas = useMemo(() => {
    return avances.map((a) => {
      const acumulado = Number(local[a.itemPresupuestoId] ?? a.porcentajeAcumulado);
      const anterior = Number(a.porcentajeAnterior);
      const delta = acumulado - anterior;
      const cantidad = Number(a.itemCantidad);
      const precio = Number(a.itemPrecioCliente);
      const montoNeto = precio * cantidad * delta / 100;
      const porcentajeHon = Number(a.porcentajeHonorariosAplicado);
      const montoHon = montoNeto * porcentajeHon / 100;
      return {
        ...a,
        acumuladoLocal: acumulado,
        delta,
        montoNetoPreview: montoNeto,
        montoHonPreview: montoHon,
        retrocede: delta < 0,
      };
    });
  }, [avances, local]);

  const totalNetoPreview = filas.reduce((s, f) => s + f.montoNetoPreview, 0);
  const totalHonPreview = filas.reduce((s, f) => s + f.montoHonPreview, 0);
  const totalGeneralPreview = totalNetoPreview + totalHonPreview;

  function handleChange(itemId: string, value: string) {
    if (readonly) return;
    // Acepta "" temporalmente; al guardar, "" se interpreta como 0.
    setLocal((prev) => ({ ...prev, [itemId]: value }));
  }

  function handleGuardar() {
    setError(null);
    setWarnings([]);
    const payload = {
      certificacionId: certId,
      avances: avances.map((a) => ({
        itemPresupuestoId: a.itemPresupuestoId,
        porcentajeAcumulado: Number(local[a.itemPresupuestoId] ?? a.porcentajeAcumulado) || 0,
      })),
    };
    startTransition(async () => {
      const r = await actualizarAvance(payload);
      if (r.ok) {
        toast.success('Avance guardado');
        // Reset initialRef para reflejar el nuevo estado guardado.
        initialRef.current = { ...local };
        if (r.warnings.length > 0) {
          setWarnings(r.warnings);
        }
      } else {
        setError(r.error);
        toast.error(r.error);
      }
    });
  }

  return (
    <>
      <Toaster />
      <div className="space-y-3">
        {warnings.length > 0 && (
          <div className="rounded-lg border border-amber-300 bg-amber-50 text-amber-900 px-4 py-3 text-[12.5px]">
            <div className="flex items-start gap-2">
              <AlertTriangle className="size-4 shrink-0 mt-0.5" aria-hidden />
              <div>
                <div className="font-medium">Avances que retroceden (se guardó igual):</div>
                <ul className="mt-1 space-y-0.5 ml-3 list-disc">
                  {warnings.map((w, i) => <li key={i}>{w}</li>)}
                </ul>
              </div>
            </div>
          </div>
        )}

        <div className="rounded-xl border bg-card overflow-hidden shadow-[0_1px_2px_rgba(16,24,40,0.04),0_1px_3px_rgba(16,24,40,0.06)]">
          <Table>
            <TableHeader>
              <TableRow className="bg-secondary/60 hover:bg-secondary/60 border-b">
                <TableHead className="text-[10.5px] font-semibold uppercase tracking-[0.06em] text-muted-foreground/85">Item</TableHead>
                <TableHead className="text-[10.5px] font-semibold uppercase tracking-[0.06em] text-muted-foreground/85 text-right">Cant.</TableHead>
                <TableHead className="text-[10.5px] font-semibold uppercase tracking-[0.06em] text-muted-foreground/85 text-right">Precio Unit.</TableHead>
                <TableHead className="text-[10.5px] font-semibold uppercase tracking-[0.06em] text-muted-foreground/85 text-right">% Ant.</TableHead>
                <TableHead className="text-[10.5px] font-semibold uppercase tracking-[0.06em] text-muted-foreground/85 text-right">% Acum.</TableHead>
                <TableHead className="text-[10.5px] font-semibold uppercase tracking-[0.06em] text-muted-foreground/85 text-right">Δ</TableHead>
                <TableHead className="text-[10.5px] font-semibold uppercase tracking-[0.06em] text-muted-foreground/85 text-right">Monto neto</TableHead>
                <TableHead className="text-[10.5px] font-semibold uppercase tracking-[0.06em] text-muted-foreground/85 text-right">% Hon.</TableHead>
                <TableHead className="text-[10.5px] font-semibold uppercase tracking-[0.06em] text-muted-foreground/85 text-right">Honorarios</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filas.map((f) => (
                <TableRow key={f.id} className={cn('hover:bg-secondary/40 transition-colors', f.retrocede && 'bg-amber-50/50')}>
                  <TableCell className="text-[13px]">
                    <div className="font-medium">{f.itemDescripcion}</div>
                    {f.rubroNombre && (
                      <div className="text-[10.5px] text-muted-foreground">{f.rubroNombre}</div>
                    )}
                  </TableCell>
                  <TableCell className="text-right font-mono tabular-nums text-[12.5px] text-muted-foreground">
                    {Number(f.itemCantidad).toLocaleString('es-AR')} {f.itemUnidad}
                  </TableCell>
                  <TableCell className="text-right font-mono tabular-nums text-[12.5px] text-muted-foreground">
                    {formatMoney(f.itemPrecioCliente, moneda)}
                  </TableCell>
                  <TableCell className="text-right font-mono tabular-nums text-[12.5px] text-muted-foreground">
                    {Number(f.porcentajeAnterior).toFixed(1)}%
                  </TableCell>
                  <TableCell className="text-right">
                    {readonly ? (
                      <span className="font-mono tabular-nums text-[13px]">
                        {Number(local[f.itemPresupuestoId] ?? f.porcentajeAcumulado).toFixed(1)}%
                      </span>
                    ) : (
                      <Input
                        type="number"
                        min="0"
                        max="100"
                        step="0.01"
                        value={local[f.itemPresupuestoId] ?? ''}
                        onChange={(e) => handleChange(f.itemPresupuestoId, e.target.value)}
                        className="h-7 text-right font-mono tabular-nums text-[12.5px] w-[80px] ml-auto"
                      />
                    )}
                  </TableCell>
                  <TableCell className={cn('text-right font-mono tabular-nums text-[12.5px]', f.retrocede ? 'text-amber-700' : 'text-muted-foreground')}>
                    {f.delta >= 0 ? '+' : ''}{f.delta.toFixed(1)}%
                  </TableCell>
                  <TableCell className="text-right font-mono tabular-nums text-[13px]">
                    {formatMoney(f.montoNetoPreview, moneda)}
                  </TableCell>
                  <TableCell className="text-right font-mono tabular-nums text-[12px] text-muted-foreground">
                    {Number(f.porcentajeHonorariosAplicado).toFixed(1)}%
                  </TableCell>
                  <TableCell className="text-right font-mono tabular-nums text-[13px] text-amber-700">
                    {formatMoney(f.montoHonPreview, moneda)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {/* Totales */}
          <div className="grid grid-cols-[1fr_180px_180px_180px] gap-3 px-5 py-3 border-t bg-muted/30 text-[13px]">
            <div className="font-semibold text-right">Totales:</div>
            <div className="text-right font-mono tabular-nums">
              <div className="text-muted-foreground text-[10.5px]">NETO</div>
              <div className="font-semibold">{formatMoney(totalNetoPreview, moneda)}</div>
            </div>
            <div className="text-right font-mono tabular-nums">
              <div className="text-muted-foreground text-[10.5px]">HONORARIOS</div>
              <div className="font-semibold text-amber-700">{formatMoney(totalHonPreview, moneda)}</div>
            </div>
            <div className="text-right font-mono tabular-nums">
              <div className="text-muted-foreground text-[10.5px]">TOTAL GENERAL</div>
              <div className="font-bold text-[15px]">{formatMoney(totalGeneralPreview, moneda)}</div>
            </div>
          </div>
        </div>

        {error && (
          <div className="rounded-lg border border-red-300 bg-red-50 text-red-800 px-4 py-3 text-[13px]">
            {error}
          </div>
        )}

        {!readonly && (
          <div className="flex items-center justify-end gap-2">
            {dirty && (
              <span className="text-[12px] text-muted-foreground italic">Cambios sin guardar</span>
            )}
            <Button onClick={handleGuardar} disabled={pending || !dirty} size="sm">
              <Save className="size-4 mr-1" aria-hidden />
              {pending ? 'Guardando…' : 'Guardar avance'}
            </Button>
          </div>
        )}
      </div>
    </>
  );
}
