'use client';
import { useState, useTransition } from 'react';
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { cancelarPresupuesto } from '../actions';

export function CancelarDialog({ presupuestoId, version }: { presupuestoId: string; version: number }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="destructive">Cancelar presupuesto</Button>} />
      <DialogContent>
        <DialogTitle>Cancelar presupuesto</DialogTitle>
        <p className="text-sm">¿Seguro? El presupuesto pasará a estado &quot;cancelado&quot;. Para reemplazarlo, creá uno nuevo.</p>
        <div className="flex gap-2 justify-end">
          <Button variant="outline" onClick={() => setOpen(false)}>Volver</Button>
          <Button variant="destructive" disabled={pending} onClick={() => start(async () => {
            await cancelarPresupuesto(presupuestoId, version); setOpen(false);
          })}>{pending ? 'Cancelando...' : 'Confirmar'}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
