import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';

type U = { id: string; email: string; nombre: string; rol: string; activo: boolean };

export function UsuariosTable({ usuarios }: { usuarios: U[] }) {
  if (usuarios.length === 0) {
    return (
      <div className="rounded-lg border bg-card px-6 py-12 text-center">
        <p className="text-[14px] font-medium text-foreground">Sin usuarios todavía</p>
        <p className="mt-1 text-[13px] text-muted-foreground">Invitá al primer admin u operador.</p>
      </div>
    );
  }
  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-secondary/60 hover:bg-secondary/60 border-b">
            <TableHead className="text-[10.5px] font-semibold uppercase tracking-[0.06em] text-muted-foreground/85">Nombre</TableHead>
            <TableHead className="text-[10.5px] font-semibold uppercase tracking-[0.06em] text-muted-foreground/85">Email</TableHead>
            <TableHead className="text-[10.5px] font-semibold uppercase tracking-[0.06em] text-muted-foreground/85">Rol</TableHead>
            <TableHead className="text-[10.5px] font-semibold uppercase tracking-[0.06em] text-muted-foreground/85">Estado</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {usuarios.map((u) => (
            <TableRow key={u.id} className="hover:bg-secondary/40 transition-colors">
              <TableCell className="text-[14px] font-medium">{u.nombre}</TableCell>
              <TableCell className="text-[13.5px] text-muted-foreground font-mono">{u.email}</TableCell>
              <TableCell>
                <span
                  className={cn(
                    'inline-flex items-center rounded-full border px-2 py-0.5 text-[11.5px] font-medium capitalize',
                    u.rol === 'admin'
                      ? 'border-primary/30 bg-primary/10 text-primary'
                      : 'border-border bg-secondary text-muted-foreground',
                  )}
                >
                  {u.rol}
                </span>
              </TableCell>
              <TableCell>
                <span
                  className={cn(
                    'inline-flex items-center gap-1.5 text-[12.5px]',
                    u.activo ? 'text-emerald-700' : 'text-muted-foreground',
                  )}
                >
                  <span
                    className={cn(
                      'size-1.5 rounded-full',
                      u.activo ? 'bg-emerald-500' : 'bg-muted-foreground/50',
                    )}
                    aria-hidden
                  />
                  {u.activo ? 'Activo' : 'Inactivo'}
                </span>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
