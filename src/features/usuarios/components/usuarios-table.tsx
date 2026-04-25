import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
type U = { id: string; email: string; nombre: string; rol: string; activo: boolean };
export function UsuariosTable({ usuarios }: { usuarios: U[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow><TableHead>Nombre</TableHead><TableHead>Email</TableHead><TableHead>Rol</TableHead><TableHead>Activo</TableHead></TableRow>
      </TableHeader>
      <TableBody>
        {usuarios.map((u) => (
          <TableRow key={u.id}>
            <TableCell>{u.nombre}</TableCell>
            <TableCell>{u.email}</TableCell>
            <TableCell>{u.rol}</TableCell>
            <TableCell>{u.activo ? 'Sí' : 'No'}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
