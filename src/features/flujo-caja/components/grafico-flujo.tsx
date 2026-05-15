'use client';

import { useMemo, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from 'recharts';
import { Button } from '@/components/ui/button';
import { formatMoneyCompact, formatMoney } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { FlujoPorDia } from '../queries';

type Props = { datos: FlujoPorDia[] };

// Si el rango supera 60 días, agrupamos por semana para evitar ruido visual.
function agruparSiHaceFalta(datos: FlujoPorDia[]) {
  if (datos.length <= 60) return { rows: datos, agrupado: 'dia' as const };
  // ISO week para no depender de date-fns: yyyy-Wnn (lunes como inicio de semana).
  const grupos = new Map<string, FlujoPorDia>();
  for (const r of datos) {
    const d = new Date(r.fecha);
    const año = d.getUTCFullYear();
    const inicioAño = new Date(Date.UTC(año, 0, 1));
    const dias = Math.floor((d.getTime() - inicioAño.getTime()) / 86400000);
    const semana = Math.ceil((dias + inicioAño.getUTCDay() + 1) / 7);
    const key = `${año}-W${String(semana).padStart(2, '0')}`;
    const acc = grupos.get(key);
    if (acc) {
      grupos.set(key, {
        fecha: key,
        ingresoArs: String(Number(acc.ingresoArs) + Number(r.ingresoArs)),
        egresoArs: String(Number(acc.egresoArs) + Number(r.egresoArs)),
        ingresoUsd: String(Number(acc.ingresoUsd) + Number(r.ingresoUsd)),
        egresoUsd: String(Number(acc.egresoUsd) + Number(r.egresoUsd)),
      });
    } else {
      grupos.set(key, { ...r, fecha: key });
    }
  }
  return { rows: Array.from(grupos.values()), agrupado: 'semana' as const };
}

function formatXAxis(fecha: string, agrupado: 'dia' | 'semana'): string {
  if (agrupado === 'semana') return fecha.split('-W')[1] + 'w';
  const d = new Date(fecha);
  return `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function GraficoFlujo({ datos }: Props) {
  const [moneda, setMoneda] = useState<'ARS' | 'USD'>('ARS');

  const { chartData, agrupado, hayDatos } = useMemo(() => {
    const { rows, agrupado } = agruparSiHaceFalta(datos);
    const data = rows.map((r) => ({
      fecha: r.fecha,
      fechaLabel: formatXAxis(r.fecha, agrupado),
      ingreso: Number(moneda === 'ARS' ? r.ingresoArs : r.ingresoUsd),
      egreso: -Number(moneda === 'ARS' ? r.egresoArs : r.egresoUsd),
    }));
    const total = data.reduce((acc, r) => acc + Math.abs(r.ingreso) + Math.abs(r.egreso), 0);
    return { chartData: data, agrupado, hayDatos: total > 0 };
  }, [datos, moneda]);

  return (
    <div className="rounded-xl border bg-card p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04),0_1px_3px_rgba(16,24,40,0.06)] h-full flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-[13px] font-semibold">Flujo del período</h3>
          <p className="text-[11px] text-muted-foreground">
            Ingresos (positivo) y egresos (negativo) {agrupado === 'semana' ? 'por semana' : 'por día'}
          </p>
        </div>
        <div className="flex gap-1">
          {(['ARS', 'USD'] as const).map((m) => (
            <Button
              key={m}
              size="sm"
              variant={moneda === m ? 'default' : 'outline'}
              className="h-6 text-[11px] px-2"
              onClick={() => setMoneda(m)}
            >
              {m}
            </Button>
          ))}
        </div>
      </div>
      <div className={cn('flex-1', !hayDatos && 'flex items-center justify-center')}>
        {!hayDatos ? (
          <div className="text-center text-[13px] text-muted-foreground py-12">
            Sin movimientos en {moneda} en este período.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" />
              <XAxis
                dataKey="fechaLabel"
                tick={{ fontSize: 10, fill: 'rgb(115 115 115)' }}
                tickLine={false}
                axisLine={{ stroke: 'rgba(0,0,0,0.1)' }}
              />
              <YAxis
                tick={{ fontSize: 10, fill: 'rgb(115 115 115)' }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => formatMoneyCompact(v, moneda).replace(moneda === 'USD' ? 'US$' : '$', '')}
                width={60}
              />
              <Tooltip
                cursor={{ fill: 'rgba(0,0,0,0.04)' }}
                content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null;
                  const ingreso = (payload.find((p) => p.dataKey === 'ingreso')?.value as number) ?? 0;
                  const egreso = Math.abs((payload.find((p) => p.dataKey === 'egreso')?.value as number) ?? 0);
                  const neto = ingreso - egreso;
                  return (
                    <div className="rounded-lg border bg-popover text-popover-foreground shadow-md p-2.5 text-[12px]">
                      <div className="font-medium mb-1.5">{label}</div>
                      <div className="grid gap-1 font-mono tabular-nums">
                        <div className="flex justify-between gap-3 text-emerald-700">
                          <span>Ingresos</span><span>{formatMoney(ingreso, moneda)}</span>
                        </div>
                        <div className="flex justify-between gap-3 text-red-600">
                          <span>Egresos</span><span>{formatMoney(egreso, moneda)}</span>
                        </div>
                        <div className={cn(
                          'flex justify-between gap-3 pt-1 mt-1 border-t font-semibold',
                          neto >= 0 ? 'text-emerald-700' : 'text-red-600',
                        )}>
                          <span>Neto</span><span>{formatMoney(neto, moneda)}</span>
                        </div>
                      </div>
                    </div>
                  );
                }}
              />
              <Legend
                wrapperStyle={{ fontSize: 11 }}
                iconType="circle"
                formatter={(value) => value === 'ingreso' ? 'Ingresos' : 'Egresos'}
              />
              <Bar dataKey="ingreso" fill="#10b981" radius={[2, 2, 0, 0]} />
              <Bar dataKey="egreso" fill="#ef4444" radius={[0, 0, 2, 2]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
