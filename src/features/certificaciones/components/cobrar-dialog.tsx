'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Coins } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { Toaster } from '@/components/ui/sonner';
import { formatMoney } from '@/lib/format';
import { marcarCobrada } from '../actions';

type Cuenta = { id: string; nombre: string; moneda: 'USD' | 'ARS'; tipo: string };

type Props = {
  certId: string;
  totalNeto: string;
  totalHonorarios: string;
  totalGeneral: string;
  moneda: 'USD' | 'ARS';
  cuentas: Cuenta[];
};

export function CobrarDialog({ certId, totalNeto, totalHonorarios, totalGeneral, moneda, cuentas }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [cuentaId, setCuentaId] = useState('');
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10));

  // Solo cuentas con la misma moneda que la certificación.
  const cuentasFiltradas = cuentas.filter((c) => c.moneda === moneda);

  function handleSubmit() {
    setError(null);
    if (!cuentaId) {
      setError('Seleccioná una cuenta');
      return;
    }
    startTransition(async () => {
      const r = await marcarCobrada({ certificacionId: certId, cuentaId, fecha });
      if (r.ok) {
        toast.success('Certificación marcada como cobrada. Movimientos creados.');
        setOpen(false);
        router.refresh();
      } else {
        setError(r.error);
        toast.error(r.error);
      }
    });
  }

  return (
    <>
      <Toaster />
      <Button onClick={() => setOpen(true)} size="sm" className="gap-1.5">
        <Coins className="size-4" aria-hidden />
        Marcar cobrada
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Marcar cobrada</DialogTitle>
            <DialogDescription>
              Al confirmar se crearán automáticamente 2 movimientos en la cuenta seleccionada:
              uno por el monto neto (concepto COBRO_CERTIFICACION) y otro por los honorarios (concepto HO).
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4">
            <div className="rounded-lg border bg-secondary/30 px-4 py-3 grid gap-1.5 text-[13px]">
              <div className="flex justify-between">
                <span>Monto neto</span>
                <span className="font-mono tabular-nums">{formatMoney(totalNeto, moneda)}</span>
              </div>
              <div className="flex justify-between text-amber-700">
                <span>Honorarios</span>
                <span className="font-mono tabular-nums">{formatMoney(totalHonorarios, moneda)}</span>
              </div>
              <div className="flex justify-between pt-1.5 border-t font-semibold">
                <span>Total a cobrar</span>
                <span className="font-mono tabular-nums">{formatMoney(totalGeneral, moneda)}</span>
              </div>
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="cobrar-cuenta">Cuenta destino</Label>
              <Select value={cuentaId} onValueChange={(v) => setCuentaId(v ?? '')}>
                <SelectTrigger id="cobrar-cuenta"><SelectValue placeholder="Elegí cuenta…" /></SelectTrigger>
                <SelectContent>
                  {cuentasFiltradas.length === 0 ? (
                    <div className="text-[12px] text-muted-foreground px-3 py-2">
                      No hay cuentas activas en {moneda}.
                    </div>
                  ) : cuentasFiltradas.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.nombre} <span className="text-muted-foreground text-[11px] ml-1">({c.tipo})</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="cobrar-fecha">Fecha del cobro</Label>
              <Input
                id="cobrar-fecha"
                type="date"
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
              />
            </div>

            {error && (
              <div className="rounded-lg border border-red-300 bg-red-50 text-red-800 px-3 py-2 text-[12.5px]">
                {error}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={handleSubmit} disabled={pending || !cuentaId}>
              {pending ? 'Cobrando…' : 'Confirmar cobro'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
