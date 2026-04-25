import Link from 'next/link';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

type Obra = {
  id: string; codigo: string; nombre: string; clienteNombre: string;
  estado: string; monedaBase: string; createdAt: Date;
};

export function ObrasTable({ obras }: { obras: Obra[] }) {
  if (obras.length === 0) return <p className="text-muted-foreground">No hay obras.</p>;
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Código</TableHead>
          <TableHead>Nombre</TableHead>
          <TableHead>Cliente</TableHead>
          <TableHead>Estado</TableHead>
          <TableHead>Moneda</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {obras.map((o) => (
          <TableRow key={o.id} className="cursor-pointer">
            <TableCell><Link href={`/obras/${o.id}`} className="font-mono text-sm">{o.codigo}</Link></TableCell>
            <TableCell>{o.nombre}</TableCell>
            <TableCell>{o.clienteNombre}</TableCell>
            <TableCell><span className="text-xs px-2 py-0.5 rounded bg-slate-100">{o.estado}</span></TableCell>
            <TableCell>{o.monedaBase}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
