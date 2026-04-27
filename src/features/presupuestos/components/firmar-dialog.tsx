'use client';
import { useState, useTransition } from 'react';
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { firmarPresupuesto } from '../actions';

export function FirmarDialog({ presupuestoId, version, dirty }: { presupuestoId: string; version: number; dirty: boolean }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button disabled={dirty}>{dirty ? 'Guardá primero' : 'Firmar presupuesto'}</Button>} />
      <DialogContent>
        <DialogTitle>Firmar presupuesto</DialogTitle>
        <p className="text-sm text-muted-foreground">Una vez firmado, no se puede editar. Si hay errores, hay que cancelarlo y reemitir.</p>
        {err && <p className="text-sm text-red-600">{err}</p>}
        <div className="flex gap-2 justify-end">
          <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button disabled={pending} onClick={() => start(async () => {
            const r = await firmarPresupuesto(presupuestoId, version);
            if (!r.ok) setErr(r.error);
            else setOpen(false);
          })}>{pending ? 'Firmando...' : 'Confirmar firma'}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
