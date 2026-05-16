import Link from 'next/link';
import { FileText, ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { formatMoney, formatDate } from '@/lib/format';
import { cn } from '@/lib/utils';

type CertRow = {
  id: string;
  numero: number;
  fecha: Date;
  estado: 'borrador' | 'emitida' | 'cobrada' | 'anulada';
  totalNeto: string;
  totalHonorarios: string;
  totalGeneral: string;
  moneda: 'USD' | 'ARS';
  presupuestoNumero: number;
  fechaCobro: Date | null;
};

const ESTADO_TONE: Record<CertRow['estado'], string> = {
  borrador: 'border-amber-300 bg-amber-50 text-amber-800',
  emitida: 'border-blue-300 bg-blue-50 text-blue-800',
  cobrada: 'border-emerald-300 bg-emerald-50 text-emerald-800',
  anulada: 'border-red-300 bg-red-50 text-red-800',
};

export function CertificacionesTabla({
  obraId,
  rows,
}: {
  obraId: string;
  rows: CertRow[];
}) {
  if (rows.length === 0) {
    return (
      <div className="rounded-xl border bg-card px-6 py-16 text-center shadow-[0_1px_2px_rgba(16,24,40,0.04),0_1px_3px_rgba(16,24,40,0.06)]">
        <FileText className="size-10 mx-auto text-muted-foreground/40 mb-3" aria-hidden />
        <p className="text-[14px] font-medium">Sin certificaciones</p>
        <p className="mt-1 text-[13px] text-muted-foreground">
          Creá la primera con &ldquo;Nueva certificación&rdquo;.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border bg-card overflow-hidden shadow-[0_1px_2px_rgba(16,24,40,0.04),0_1px_3px_rgba(16,24,40,0.06)]">
      <Table>
        <TableHeader>
          <TableRow className="bg-secondary/60 hover:bg-secondary/60 border-b">
            <TableHead className="text-[10.5px] font-semibold uppercase tracking-[0.06em] text-muted-foreground/85">N°</TableHead>
            <TableHead className="text-[10.5px] font-semibold uppercase tracking-[0.06em] text-muted-foreground/85">Fecha</TableHead>
            <TableHead className="text-[10.5px] font-semibold uppercase tracking-[0.06em] text-muted-foreground/85">Estado</TableHead>
            <TableHead className="text-[10.5px] font-semibold uppercase tracking-[0.06em] text-muted-foreground/85">Presup.</TableHead>
            <TableHead className="text-[10.5px] font-semibold uppercase tracking-[0.06em] text-muted-foreground/85 text-right">Neto</TableHead>
            <TableHead className="text-[10.5px] font-semibold uppercase tracking-[0.06em] text-muted-foreground/85 text-right">Honorarios</TableHead>
            <TableHead className="text-[10.5px] font-semibold uppercase tracking-[0.06em] text-muted-foreground/85 text-right">Total</TableHead>
            <TableHead className="w-0" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((c) => (
            <TableRow
              key={c.id}
              className={cn(
                'group transition-colors',
                c.estado === 'anulada' && 'opacity-50',
              )}
            >
              <TableCell className="font-mono text-[12.5px]">N° {c.numero}</TableCell>
              <TableCell className="text-[12.5px] text-muted-foreground">{formatDate(c.fecha)}</TableCell>
              <TableCell>
                <Badge variant="outline" className={cn('font-normal capitalize', ESTADO_TONE[c.estado])}>
                  {c.estado}
                </Badge>
              </TableCell>
              <TableCell className="font-mono text-[11.5px] text-muted-foreground">#{c.presupuestoNumero}</TableCell>
              <TableCell className="text-right font-mono tabular-nums text-[13px]">
                {formatMoney(c.totalNeto, c.moneda)}
              </TableCell>
              <TableCell className="text-right font-mono tabular-nums text-[13px] text-amber-700">
                {formatMoney(c.totalHonorarios, c.moneda)}
              </TableCell>
              <TableCell className="text-right font-mono tabular-nums text-[13.5px] font-semibold">
                {formatMoney(c.totalGeneral, c.moneda)}
              </TableCell>
              <TableCell>
                <Link
                  href={`/obras/${obraId}/certificaciones/${c.id}`}
                  className="inline-flex items-center text-muted-foreground hover:text-foreground transition-colors"
                >
                  <ChevronRight className="size-4" aria-hidden />
                </Link>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
