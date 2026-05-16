'use client';

import { useState, useTransition, useMemo, useRef, useEffect, Fragment } from 'react';
import { useRouter } from 'next/navigation';
import { Check, TrendingUp, CheckCircle2, Circle, Hammer } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Toaster } from '@/components/ui/sonner';
import { cn } from '@/lib/utils';
import { formatMoney } from '@/lib/format';
import { actualizarAvanceItem } from '../actions';
import type { ItemAvance, AvanceObra } from '../queries';

type Props = {
  data: AvanceObra;
  readonly?: boolean;
};

// Debounce simple para evitar guardar en cada keystroke del slider.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function useDebouncedCallback<T extends (...args: any[]) => unknown>(
  fn: T,
  ms: number,
): (...args: Parameters<T>) => void {
  const fnRef = useRef(fn);
  fnRef.current = fn;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  return (...args: Parameters<T>) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => fnRef.current(...args), ms);
  };
}

export function AvanceEditor({ data, readonly = false }: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  // Estado local del % por itemId (string, para soportar input vacío durante edición).
  const [local, setLocal] = useState<Record<string, string>>(() => {
    const m: Record<string, string> = {};
    for (const it of data.items) m[it.id] = it.porcentajeAvance;
    return m;
  });
  // Items que se acaban de guardar (para el feedback visual de "✓ guardado").
  const [recientes, setRecientes] = useState<Set<string>>(new Set());

  // Recalcular agrupación por rubro y totales en vivo.
  const grupos = useMemo(() => {
    const g: Record<string, { rubro: string; items: ItemAvance[] }> = {};
    for (const it of data.items) {
      g[it.rubroNombre] ??= { rubro: it.rubroNombre, items: [] };
      g[it.rubroNombre].items.push(it);
    }
    return Object.values(g);
  }, [data.items]);

  const totales = useMemo(() => {
    let montoTotal = 0;
    let montoEjecutado = 0;
    let completados = 0;
    for (const it of data.items) {
      const monto = Number(it.precioUnitarioCliente) * Number(it.cantidad);
      const pct = Math.min(100, Math.max(0, Number(local[it.id] ?? it.porcentajeAvance) || 0));
      montoTotal += monto;
      montoEjecutado += monto * (pct / 100);
      if (pct >= 100) completados++;
    }
    return {
      progresoGlobal: montoTotal > 0 ? (montoEjecutado / montoTotal) * 100 : 0,
      montoEjecutado,
      montoTotal,
      completados,
    };
  }, [data.items, local]);

  const persistirItem = useDebouncedCallback((itemId: string, valor: number) => {
    startTransition(async () => {
      const r = await actualizarAvanceItem({ itemId, porcentaje: valor });
      if (r.ok) {
        setRecientes((s) => new Set(s).add(itemId));
        setTimeout(() => {
          setRecientes((s) => {
            const n = new Set(s);
            n.delete(itemId);
            return n;
          });
        }, 1500);
        router.refresh();
      } else {
        toast.error(r.error);
      }
    });
  }, 600);

  function actualizarItem(itemId: string, raw: string) {
    if (readonly) return;
    setLocal((prev) => ({ ...prev, [itemId]: raw }));
    const num = Number(raw);
    if (Number.isFinite(num) && num >= 0 && num <= 100) {
      persistirItem(itemId, num);
    }
  }

  function marcarHecho(itemId: string) {
    if (readonly) return;
    actualizarItem(itemId, '100');
  }

  function marcarCero(itemId: string) {
    if (readonly) return;
    actualizarItem(itemId, '0');
  }

  return (
    <>
      <Toaster />

      <div className="space-y-6">
        {/* Header con barra de progreso global */}
        <div className="rounded-2xl border bg-gradient-to-br from-card to-secondary/20 p-6 shadow-[0_1px_2px_rgba(16,24,40,0.04),0_2px_8px_rgba(16,24,40,0.06)]">
          <div className="flex items-end justify-between gap-4 mb-4">
            <div>
              <p className="text-[10.5px] font-semibold uppercase tracking-[0.1em] text-muted-foreground/70 mb-1 flex items-center gap-1.5">
                <TrendingUp className="size-3" aria-hidden />
                Progreso de obra
              </p>
              <div className="flex items-baseline gap-2">
                <span className="text-[42px] font-bold leading-none tabular-nums">
                  {totales.progresoGlobal.toFixed(1)}
                </span>
                <span className="text-[20px] text-muted-foreground font-semibold">%</span>
              </div>
              <p className="mt-2 text-[12.5px] text-muted-foreground">
                {totales.completados} de {data.items.length} ítems completados ·{' '}
                <span className="font-mono">{formatMoney(totales.montoEjecutado, data.monedaBase, { minDecimals: 0, maxDecimals: 0 })}</span>{' '}
                de <span className="font-mono">{formatMoney(totales.montoTotal, data.monedaBase, { minDecimals: 0, maxDecimals: 0 })}</span>
              </p>
            </div>
            {totales.progresoGlobal >= 100 && (
              <div className="flex items-center gap-2 rounded-full bg-emerald-100 px-3 py-1.5 text-[12px] font-semibold text-emerald-800">
                <CheckCircle2 className="size-4" aria-hidden />
                Obra completada
              </div>
            )}
          </div>
          {/* Barra grande animada */}
          <div className="relative h-3 rounded-full bg-secondary overflow-hidden">
            <div
              className={cn(
                'absolute inset-y-0 left-0 transition-all duration-500 ease-out rounded-full',
                totales.progresoGlobal >= 100
                  ? 'bg-gradient-to-r from-emerald-400 to-emerald-500'
                  : 'bg-gradient-to-r from-primary/70 to-primary',
              )}
              style={{ width: `${Math.min(100, totales.progresoGlobal)}%` }}
            />
            {/* Tick marks cada 25% */}
            {[25, 50, 75].map((pct) => (
              <div
                key={pct}
                className="absolute top-0 bottom-0 w-px bg-background/30"
                style={{ left: `${pct}%` }}
                aria-hidden
              />
            ))}
          </div>
        </div>

        {/* Lista por rubro */}
        <div className="space-y-4">
          {grupos.map((g) => {
            // Progreso del rubro
            let rTotal = 0, rEjec = 0;
            for (const it of g.items) {
              const monto = Number(it.precioUnitarioCliente) * Number(it.cantidad);
              const pct = Number(local[it.id] ?? it.porcentajeAvance) || 0;
              rTotal += monto;
              rEjec += monto * (pct / 100);
            }
            const progresoRubro = rTotal > 0 ? (rEjec / rTotal) * 100 : 0;

            return (
              <div key={g.rubro} className="rounded-xl border bg-card overflow-hidden shadow-[0_1px_2px_rgba(16,24,40,0.04),0_1px_3px_rgba(16,24,40,0.06)]">
                {/* Header rubro */}
                <div className="px-5 py-3 border-b bg-muted/30 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2 min-w-0">
                    <Hammer className="size-3.5 text-muted-foreground/60 shrink-0" aria-hidden />
                    <h3 className="text-[13.5px] font-semibold uppercase tracking-wide text-muted-foreground">
                      {g.rubro}
                    </h3>
                    <span className="text-[11px] text-muted-foreground/60 font-mono">
                      ({g.items.length})
                    </span>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="w-32 h-1.5 rounded-full bg-secondary overflow-hidden">
                      <div
                        className={cn(
                          'h-full transition-all duration-500 ease-out',
                          progresoRubro >= 100 ? 'bg-emerald-500' : 'bg-primary',
                        )}
                        style={{ width: `${Math.min(100, progresoRubro)}%` }}
                      />
                    </div>
                    <span className="text-[12px] font-mono tabular-nums w-12 text-right">
                      {progresoRubro.toFixed(0)}%
                    </span>
                  </div>
                </div>

                {/* Items */}
                <ul className="divide-y">
                  {g.items.map((it) => {
                    const pct = Math.min(100, Math.max(0, Number(local[it.id] ?? it.porcentajeAvance) || 0));
                    const monto = Number(it.precioUnitarioCliente) * Number(it.cantidad);
                    const recent = recientes.has(it.id);
                    const completo = pct >= 100;
                    const empezado = pct > 0;

                    return (
                      <li
                        key={it.id}
                        className={cn(
                          'group px-5 py-3.5 transition-colors',
                          completo && 'bg-emerald-50/30',
                          !completo && empezado && 'bg-blue-50/20',
                          recent && 'bg-emerald-50',
                        )}
                      >
                        <div className="flex items-start gap-4">
                          {/* Status icon */}
                          <button
                            type="button"
                            onClick={() => completo ? marcarCero(it.id) : marcarHecho(it.id)}
                            disabled={readonly}
                            className={cn(
                              'shrink-0 mt-0.5 transition-colors',
                              !readonly && 'hover:scale-110',
                              readonly && 'cursor-default',
                            )}
                            title={completo ? 'Marcar como no hecho (0%)' : 'Marcar como hecho (100%)'}
                          >
                            {completo ? (
                              <CheckCircle2 className="size-5 text-emerald-500" aria-hidden />
                            ) : empezado ? (
                              <Circle className="size-5 text-blue-500" strokeWidth={2.5} aria-hidden />
                            ) : (
                              <Circle className="size-5 text-muted-foreground/30" aria-hidden />
                            )}
                          </button>

                          {/* Descripción + monto */}
                          <div className="min-w-0 flex-1">
                            <div className={cn(
                              'text-[14px] font-medium leading-tight',
                              completo && 'text-muted-foreground line-through',
                            )}>
                              {it.descripcion}
                            </div>
                            <div className="mt-0.5 flex items-center gap-2 text-[11.5px] text-muted-foreground">
                              <span className="font-mono tabular-nums">
                                {Number(it.cantidad).toLocaleString('es-AR')} {it.unidad}
                              </span>
                              <span className="text-muted-foreground/40">·</span>
                              <span className="font-mono tabular-nums">
                                {formatMoney(monto, data.monedaBase, { minDecimals: 0, maxDecimals: 0 })}
                              </span>
                              {recent && (
                                <span className="ml-auto inline-flex items-center gap-1 text-emerald-700 font-medium">
                                  <Check className="size-3" aria-hidden />
                                  guardado
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Slider + número */}
                        {!readonly && (
                          <div className="mt-3 pl-9 flex items-center gap-3">
                            <input
                              type="range"
                              min="0"
                              max="100"
                              step="1"
                              value={local[it.id] ?? it.porcentajeAvance}
                              onChange={(e) => actualizarItem(it.id, e.target.value)}
                              className={cn(
                                'flex-1 h-2 rounded-full appearance-none cursor-pointer',
                                '[&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:size-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:transition-transform [&::-webkit-slider-thumb]:hover:scale-110',
                                completo && '[&::-webkit-slider-thumb]:bg-emerald-500',
                              )}
                              style={{
                                background: `linear-gradient(to right, ${completo ? '#10b981' : 'rgb(99 102 241)'} 0%, ${completo ? '#10b981' : 'rgb(99 102 241)'} ${pct}%, rgb(226 232 240) ${pct}%, rgb(226 232 240) 100%)`,
                              }}
                            />
                            <div className="flex items-center gap-1.5 shrink-0">
                              <Input
                                type="number"
                                min="0"
                                max="100"
                                step="1"
                                value={local[it.id] ?? ''}
                                onChange={(e) => actualizarItem(it.id, e.target.value)}
                                className="w-[68px] h-8 text-right font-mono tabular-nums text-[13px]"
                              />
                              <span className="text-[12px] text-muted-foreground">%</span>
                            </div>
                          </div>
                        )}

                        {readonly && (
                          <div className="mt-2 pl-9">
                            <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
                              <div
                                className={cn('h-full transition-all', completo ? 'bg-emerald-500' : 'bg-primary')}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <span className="mt-1 text-[11px] font-mono text-muted-foreground tabular-nums inline-block">
                              {pct.toFixed(0)}% completado
                            </span>
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </div>

        {data.items.length === 0 && (
          <div className="rounded-xl border bg-card px-6 py-16 text-center shadow-[0_1px_2px_rgba(16,24,40,0.04),0_1px_3px_rgba(16,24,40,0.06)]">
            <Hammer className="size-10 mx-auto text-muted-foreground/40 mb-3" aria-hidden />
            <p className="text-[14px] font-medium">Sin items en el presupuesto</p>
          </div>
        )}
      </div>
    </>
  );
}
