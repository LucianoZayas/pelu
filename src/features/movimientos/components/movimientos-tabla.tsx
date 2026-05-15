'use client';

import { useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowDownToLine, ArrowUpFromLine, ArrowLeftRight, FileText, Ban, RotateCcw, ExternalLink,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { toast } from 'sonner';
import { Toaster } from '@/components/ui/sonner';
import { cn } from '@/lib/utils';
import { anularMovimiento, restaurarMovimiento } from '../actions';
import type { MovimientoRow } from '../queries';

type Props = {
  rows: MovimientoRow[];
  total: number;
  esAdmin: boolean;
};

function formatMoney(value: string, moneda: 'USD' | 'ARS' | null): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return value;
  const formatted = new Intl.NumberFormat('es-AR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
  const prefix = moneda === 'USD' ? 'US$' : '$';
  return `${prefix} ${formatted}`;
}

function formatDate(d: Date | string): string {
  const date = typeof d === 'string' ? new Date(d) : d;
  return date.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

const TIPO_ICON = {
  entrada: ArrowDownToLine,
  salida: ArrowUpFromLine,
  transferencia: ArrowLeftRight,
};

const TIPO_TONE = {
  entrada: 'text-emerald-700',
  salida: 'text-red-700',
  transferencia: 'text-blue-700',
};

export function MovimientosTabla({ rows, total, esAdmin }: Props) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function handleAnular(id: string) {
    const motivo = prompt('Motivo de la anulación (mín. 3 caracteres):');
    if (!motivo || motivo.trim().length < 3) {
      if (motivo !== null) toast.error('Motivo demasiado corto');
      return;
    }
    startTransition(async () => {
      const r = await anularMovimiento(id, { motivo: motivo.trim() });
      if (r.ok) {
        toast.success('Movimiento anulado');
        router.refresh();
      } else {
        toast.error(r.error);
      }
    });
  }

  function handleRestaurar(id: string) {
    if (!confirm('¿Restaurar este movimiento? Volverá a contar para los saldos.')) return;
    startTransition(async () => {
      const r = await restaurarMovimiento(id);
      if (r.ok) {
        toast.success('Movimiento restaurado');
        router.refresh();
      } else {
        toast.error(r.error);
      }
    });
  }

  if (rows.length === 0) {
    return (
      <>
        <Toaster />
        <div className="rounded-xl border bg-card px-6 py-16 text-center shadow-[0_1px_2px_rgba(16,24,40,0.04),0_1px_3px_rgba(16,24,40,0.06)]">
          <FileText className="size-10 mx-auto text-muted-foreground/40 mb-3" aria-hidden />
          <p className="text-[14px] font-medium">Sin movimientos</p>
          <p className="mt-1 text-[13px] text-muted-foreground">
            Probá ajustar los filtros o cargá el primer movimiento.
          </p>
          <Link href="/movimientos/nuevo" className="inline-block mt-4">
            <Button size="sm">Cargar movimiento</Button>
          </Link>
        </div>
      </>
    );
  }

  return (
    <>
      <Toaster />
      <div className="rounded-xl border bg-card overflow-hidden shadow-[0_1px_2px_rgba(16,24,40,0.04),0_1px_3px_rgba(16,24,40,0.06)]">
        <Table>
          <TableHeader>
            <TableRow className="bg-secondary/60 hover:bg-secondary/60 border-b">
              <TableHead className="text-[10.5px] font-semibold uppercase tracking-[0.06em] text-muted-foreground/85 w-[80px]">Fecha</TableHead>
              <TableHead className="text-[10.5px] font-semibold uppercase tracking-[0.06em] text-muted-foreground/85">Concepto</TableHead>
              <TableHead className="text-[10.5px] font-semibold uppercase tracking-[0.06em] text-muted-foreground/85">Detalle</TableHead>
              <TableHead className="text-[10.5px] font-semibold uppercase tracking-[0.06em] text-muted-foreground/85">Cuenta</TableHead>
              <TableHead className="text-[10.5px] font-semibold uppercase tracking-[0.06em] text-muted-foreground/85 text-right">Monto</TableHead>
              <TableHead className="text-[10.5px] font-semibold uppercase tracking-[0.06em] text-muted-foreground/85">Estado</TableHead>
              <TableHead className="w-0" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => {
              const Icon = TIPO_ICON[r.tipo];
              const tone = TIPO_TONE[r.tipo];
              const isAnulado = r.estado === 'anulado';
              const puedeAnular = esAdmin && !isAnulado;
              const puedeRestaurar = esAdmin && isAnulado;
              return (
                <TableRow
                  key={r.id}
                  className={cn(
                    'group hover:bg-secondary/40 transition-colors',
                    isAnulado && 'opacity-50',
                  )}
                >
                  <TableCell className="text-[12.5px] text-muted-foreground tabular-nums">
                    {formatDate(r.fecha)}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Icon className={cn('size-4', tone)} aria-hidden />
                      <div className="grid">
                        <span className="text-[13.5px] font-medium leading-tight">{r.conceptoNombre ?? '—'}</span>
                        {r.conceptoCodigo && (
                          <span className="font-mono text-[10.5px] text-muted-foreground leading-tight">
                            {r.conceptoCodigo}
                          </span>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-[12.5px] text-muted-foreground max-w-[280px]">
                    {r.obraCodigo && (
                      <div>
                        <Link href={`/obras/${r.obraId}`} className="hover:underline text-foreground">
                          <span className="font-mono text-[11px]">{r.obraCodigo}</span> {r.obraNombre}
                        </Link>
                      </div>
                    )}
                    {r.parteOrigenNombre && r.tipo === 'entrada' && (
                      <div>De: {r.parteOrigenNombre}</div>
                    )}
                    {r.parteDestinoNombre && r.tipo === 'salida' && (
                      <div>A: {r.parteDestinoNombre}</div>
                    )}
                    {r.proveedorNombre && (
                      <div>Proveedor: {r.proveedorNombre}</div>
                    )}
                    {r.descripcion && (
                      <div className="truncate" title={r.descripcion}>{r.descripcion}</div>
                    )}
                    {r.esNoRecuperable && (
                      <Badge variant="outline" className="font-normal border-orange-300 bg-orange-50 text-orange-800 text-[10px] mt-1">
                        no recuperable
                      </Badge>
                    )}
                    {isAnulado && r.anuladoMotivo && (
                      <div className="text-red-700 italic">Anulado: {r.anuladoMotivo}</div>
                    )}
                  </TableCell>
                  <TableCell className="text-[12.5px]">
                    {r.cuentaNombre}
                    {r.tipo === 'transferencia' && r.cuentaDestinoNombre && (
                      <>
                        <ArrowLeftRight className="size-3 mx-1 inline text-muted-foreground" aria-hidden />
                        {r.cuentaDestinoNombre}
                      </>
                    )}
                  </TableCell>
                  <TableCell className="text-right font-mono tabular-nums text-[13.5px]">
                    <div className={cn(tone)}>
                      {r.tipo === 'salida' ? '−' : r.tipo === 'entrada' ? '+' : ''}
                      {formatMoney(r.monto, r.moneda)}
                    </div>
                    {r.tipo === 'transferencia' && r.montoDestino && r.cuentaDestinoMoneda && r.cuentaDestinoMoneda !== r.moneda && (
                      <div className="text-[11px] text-muted-foreground">
                        → {formatMoney(r.montoDestino, r.cuentaDestinoMoneda)}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    {isAnulado ? (
                      <Badge variant="outline" className="font-normal border-red-300 bg-red-50 text-red-800 text-[10.5px]">
                        anulado
                      </Badge>
                    ) : r.estado === 'previsto' ? (
                      <Badge variant="outline" className="font-normal border-amber-300 bg-amber-50 text-amber-800 text-[10.5px]">
                        previsto
                      </Badge>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-[12.5px] text-emerald-700">
                        <span className="size-1.5 rounded-full bg-emerald-500" aria-hidden />
                        confirmado
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {r.comprobanteUrl && (
                        <a href={r.comprobanteUrl} target="_blank" rel="noreferrer">
                          <Button variant="ghost" size="icon" className="size-7" title="Ver comprobante">
                            <ExternalLink className="size-3.5" aria-hidden />
                          </Button>
                        </a>
                      )}
                      {puedeAnular && (
                        <Button
                          variant="ghost" size="icon" className="size-7"
                          title="Anular"
                          onClick={() => handleAnular(r.id)}
                          disabled={pending}
                        >
                          <Ban className="size-3.5" aria-hidden />
                          <span className="sr-only">Anular</span>
                        </Button>
                      )}
                      {puedeRestaurar && (
                        <Button
                          variant="ghost" size="icon" className="size-7"
                          title="Restaurar"
                          onClick={() => handleRestaurar(r.id)}
                          disabled={pending}
                        >
                          <RotateCcw className="size-3.5" aria-hidden />
                          <span className="sr-only">Restaurar</span>
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
      {total > rows.length && (
        <div className="text-[12.5px] text-muted-foreground text-center mt-3">
          Mostrando {rows.length} de {total} movimientos. Refiná los filtros para ver más.
        </div>
      )}
    </>
  );
}
