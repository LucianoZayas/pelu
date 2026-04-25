'use client';
import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { invitarUsuario } from '../actions';

export function InvitarDialog() {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();

  async function handleSubmit(fd: FormData) {
    start(async () => {
      const r = await invitarUsuario({
        email: String(fd.get('email')),
        nombre: String(fd.get('nombre')),
        rol: fd.get('rol') as 'admin' | 'operador',
      });
      if (r.ok) setOpen(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button>Invitar usuario</Button>} />
      <DialogContent>
        <DialogTitle>Invitar usuario</DialogTitle>
        <form action={handleSubmit} className="space-y-3">
          <div><Label>Nombre</Label><Input name="nombre" required /></div>
          <div><Label>Email</Label><Input name="email" type="email" required /></div>
          <div>
            <Label>Rol</Label>
            <Select name="rol" defaultValue="operador">
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="operador">Operador</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button type="submit" disabled={pending}>{pending ? 'Enviando...' : 'Invitar'}</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
