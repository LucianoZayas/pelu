'use client';

import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useTransition, useState, useEffect } from 'react';
import { X, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';

type Option = { id: string; label: string };

type Props = {
  obras: Option[];
  cuentas: Option[];
  conceptos: Option[];
  partes: Option[];
};

export function MovimientosFiltros({ obras, cuentas, conceptos, partes }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  const [search, setSearch] = useState(searchParams.get('search') ?? '');

  useEffect(() => {
    setSearch(searchParams.get('search') ?? '');
  }, [searchParams]);

  function setParam(key: string, value: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (value && value !== '__todos__') {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    startTransition(() => router.push(`${pathname}?${params.toString()}`));
  }

  function clearAll() {
    startTransition(() => router.push(pathname));
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setParam('search', search.trim() || null);
  }

  const activeFilters = Array.from(searchParams.entries()).filter(([k]) =>
    ['obra', 'cuenta', 'concepto', 'parte', 'tipo', 'estado', 'desde', 'hasta', 'search'].includes(k),
  );

  return (
    <div className="rounded-xl border bg-card p-4 shadow-[0_1px_2px_rgba(16,24,40,0.04),0_1px_3px_rgba(16,24,40,0.06)] space-y-3">
      <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
        <Filter className="size-3.5" aria-hidden />
        <span className="font-medium uppercase tracking-[0.06em]">Filtros</span>
        {activeFilters.length > 0 && (
          <>
            <span className="text-muted-foreground/40">·</span>
            <button onClick={clearAll} className="hover:text-foreground transition-colors flex items-center gap-1">
              <X className="size-3" aria-hidden /> Limpiar todos
            </button>
          </>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="filt-obra" className="text-[11.5px]">Obra</Label>
          <Select
            value={searchParams.get('obra') ?? '__todos__'}
            onValueChange={(v) => setParam('obra', v)}
          >
            <SelectTrigger id="filt-obra" className="h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__todos__">Todas</SelectItem>
              <SelectItem value="__sin_obra__">Sin obra (caja empresa)</SelectItem>
              {obras.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="filt-cuenta" className="text-[11.5px]">Cuenta</Label>
          <Select
            value={searchParams.get('cuenta') ?? '__todos__'}
            onValueChange={(v) => setParam('cuenta', v)}
          >
            <SelectTrigger id="filt-cuenta" className="h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__todos__">Todas</SelectItem>
              {cuentas.map((c) => <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="filt-concepto" className="text-[11.5px]">Concepto</Label>
          <Select
            value={searchParams.get('concepto') ?? '__todos__'}
            onValueChange={(v) => setParam('concepto', v)}
          >
            <SelectTrigger id="filt-concepto" className="h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__todos__">Todos</SelectItem>
              {conceptos.map((c) => <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="filt-parte" className="text-[11.5px]">Parte</Label>
          <Select
            value={searchParams.get('parte') ?? '__todos__'}
            onValueChange={(v) => setParam('parte', v)}
          >
            <SelectTrigger id="filt-parte" className="h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__todos__">Todas</SelectItem>
              {partes.map((p) => <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="filt-tipo" className="text-[11.5px]">Tipo</Label>
          <Select
            value={searchParams.get('tipo') ?? '__todos__'}
            onValueChange={(v) => setParam('tipo', v)}
          >
            <SelectTrigger id="filt-tipo" className="h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__todos__">Todos</SelectItem>
              <SelectItem value="entrada">Ingresos</SelectItem>
              <SelectItem value="salida">Egresos</SelectItem>
              <SelectItem value="transferencia">Transferencias</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="filt-estado" className="text-[11.5px]">Estado</Label>
          <Select
            value={searchParams.get('estado') ?? '__todos__'}
            onValueChange={(v) => setParam('estado', v)}
          >
            <SelectTrigger id="filt-estado" className="h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__todos__">Todos</SelectItem>
              <SelectItem value="confirmado">Confirmados</SelectItem>
              <SelectItem value="previsto">Previstos</SelectItem>
              <SelectItem value="anulado">Anulados</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="filt-desde" className="text-[11.5px]">Desde</Label>
          <Input
            id="filt-desde"
            type="date"
            className="h-8 text-xs"
            value={searchParams.get('desde') ?? ''}
            onChange={(e) => setParam('desde', e.target.value || null)}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="filt-hasta" className="text-[11.5px]">Hasta</Label>
          <Input
            id="filt-hasta"
            type="date"
            className="h-8 text-xs"
            value={searchParams.get('hasta') ?? ''}
            onChange={(e) => setParam('hasta', e.target.value || null)}
          />
        </div>
      </div>

      <form onSubmit={handleSearch} className="grid grid-cols-[1fr_auto] gap-2">
        <Input
          placeholder="Buscar en descripción o número de comprobante…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-8 text-xs"
        />
        <Button type="submit" size="sm" disabled={pending}>Buscar</Button>
      </form>
    </div>
  );
}
