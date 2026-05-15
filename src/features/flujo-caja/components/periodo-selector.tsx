'use client';

import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useTransition, useMemo } from 'react';
import { CalendarRange } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { rangoDelPreset, type PeriodoPreset } from '@/lib/format';
import { cn } from '@/lib/utils';

const PRESETS: Array<{ key: PeriodoPreset; label: string }> = [
  { key: 'mes', label: 'Este mes' },
  { key: 'mes_pasado', label: 'Mes pasado' },
  { key: 'ultimos_30', label: 'Últimos 30 días' },
  { key: 'anio', label: 'Este año' },
];

export function PeriodoSelector({ desde, hasta }: { desde: string; hasta: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  const presetActivo = useMemo(() => {
    for (const p of PRESETS) {
      const r = rangoDelPreset(p.key);
      if (r.desde === desde && r.hasta === hasta) return p.key;
    }
    return null;
  }, [desde, hasta]);

  function aplicarPreset(preset: PeriodoPreset) {
    const r = rangoDelPreset(preset);
    const params = new URLSearchParams(searchParams.toString());
    params.set('desde', r.desde);
    params.set('hasta', r.hasta);
    startTransition(() => router.push(`${pathname}?${params.toString()}`));
  }

  function setFecha(key: 'desde' | 'hasta', value: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set(key, value);
    startTransition(() => router.push(`${pathname}?${params.toString()}`));
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground mr-1">
        <CalendarRange className="size-3.5" aria-hidden />
        <span className="uppercase tracking-[0.06em] font-medium">Período</span>
      </div>
      {PRESETS.map((p) => (
        <Button
          key={p.key}
          type="button"
          size="sm"
          variant={presetActivo === p.key ? 'default' : 'outline'}
          className={cn('h-7 text-xs', presetActivo === p.key && 'shadow-sm')}
          onClick={() => aplicarPreset(p.key)}
        >
          {p.label}
        </Button>
      ))}
      <div className="ml-2 flex items-center gap-1.5">
        <Label htmlFor="ps-desde" className="text-[11px] text-muted-foreground">Desde</Label>
        <Input
          id="ps-desde"
          type="date"
          value={desde}
          onChange={(e) => setFecha('desde', e.target.value)}
          className="h-7 text-xs w-[140px]"
        />
        <Label htmlFor="ps-hasta" className="text-[11px] text-muted-foreground">Hasta</Label>
        <Input
          id="ps-hasta"
          type="date"
          value={hasta}
          onChange={(e) => setFecha('hasta', e.target.value)}
          className="h-7 text-xs w-[140px]"
        />
      </div>
    </div>
  );
}
