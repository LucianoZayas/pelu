import Link from 'next/link';
import { ArrowRight, FileSpreadsheet } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { EstadoBadge } from '@/components/estado-badge';

type Obra = {
  id: string;
  codigo: string;
  nombre: string;
  clienteNombre: string;
  estado: string;
  monedaBase: string;
  createdAt: Date;
};

export function ObrasTable({ obras }: { obras: Obra[] }) {
  if (obras.length === 0) {
    return (
      <div className="rounded-lg border bg-card px-6 py-16 text-center">
        <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-secondary">
          <FileSpreadsheet className="size-5 text-muted-foreground" aria-hidden />
        </div>
        <p className="text-[14px] font-medium text-foreground">No hay obras todavía</p>
        <p className="mt-1 text-[13px] text-muted-foreground">
          Creá una nueva obra o importá un presupuesto desde Excel para empezar.
        </p>
      </div>
    );
  }
  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-secondary/60 hover:bg-secondary/60 border-b">
            <TableHead className="text-[10.5px] font-semibold uppercase tracking-[0.06em] text-muted-foreground/85">Código</TableHead>
            <TableHead className="text-[10.5px] font-semibold uppercase tracking-[0.06em] text-muted-foreground/85">Nombre</TableHead>
            <TableHead className="text-[10.5px] font-semibold uppercase tracking-[0.06em] text-muted-foreground/85">Cliente</TableHead>
            <TableHead className="text-[10.5px] font-semibold uppercase tracking-[0.06em] text-muted-foreground/85">Estado</TableHead>
            <TableHead className="text-[10.5px] font-semibold uppercase tracking-[0.06em] text-muted-foreground/85">Moneda</TableHead>
            <TableHead className="w-10" aria-label="Acción"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {obras.map((o) => (
            // Stretched-link pattern: the row is relative; the first cell has
            // a Link whose ::before pseudo-element fills the row, so clicking
            // anywhere on the row triggers navigation. Keyboard users get a
            // single focusable target per row (the Link).
            <TableRow
              key={o.id}
              className="group relative cursor-pointer hover:bg-secondary/40 transition-colors focus-within:bg-secondary/40"
            >
              <TableCell>
                <Link
                  href={`/obras/${o.id}`}
                  aria-label={`Abrir obra ${o.codigo} — ${o.nombre}`}
                  className="font-mono text-[12.5px] text-foreground transition-colors hover:text-primary focus-visible:outline-none focus-visible:text-primary before:absolute before:inset-0 before:content-[''] before:rounded-md focus-visible:before:ring-2 focus-visible:before:ring-ring focus-visible:before:ring-offset-2"
                >
                  {o.codigo}
                </Link>
              </TableCell>
              <TableCell className="text-[14px] font-medium text-foreground">
                {o.nombre}
              </TableCell>
              <TableCell className="text-[13.5px] text-muted-foreground">{o.clienteNombre}</TableCell>
              <TableCell>
                <EstadoBadge estado={o.estado} />
              </TableCell>
              <TableCell>
                <span className="inline-flex items-center rounded border border-border bg-secondary/50 px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">
                  {o.monedaBase}
                </span>
              </TableCell>
              <TableCell>
                <ArrowRight
                  className="size-4 text-muted-foreground/60 opacity-0 group-hover:opacity-100 transition-opacity"
                  aria-hidden
                />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
