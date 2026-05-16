'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Send, Ban } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Toaster } from '@/components/ui/sonner';
import { emitirCertificacion, anularCertificacion } from '../actions';
import { CobrarDialog } from './cobrar-dialog';

type Cuenta = { id: string; nombre: string; moneda: 'USD' | 'ARS'; tipo: string };

type Props = {
  certId: string;
  estado: 'borrador' | 'emitida' | 'cobrada' | 'anulada';
  totalNeto: string;
  totalHonorarios: string;
  totalGeneral: string;
  moneda: 'USD' | 'ARS';
  cuentas: Cuenta[];
};

export function CertActionsBar({ certId, estado, totalNeto, totalHonorarios, totalGeneral, moneda, cuentas }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [anularOpen, setAnularOpen] = useState(false);
  const [motivo, setMotivo] = useState('');

  function handleEmitir() {
    if (!confirm('¿Emitir esta certificación? Una vez emitida no se puede editar el avance (solo anular).')) return;
    startTransition(async () => {
      const r = await emitirCertificacion({ certificacionId: certId });
      if (r.ok) {
        toast.success('Certificación emitida');
        router.refresh();
      } else {
        toast.error(r.error);
      }
    });
  }

  function handleAnular() {
    if (motivo.trim().length < 3) {
      toast.error('Motivo demasiado corto (mín. 3 caracteres)');
      return;
    }
    startTransition(async () => {
      const r = await anularCertificacion({ certificacionId: certId, motivo: motivo.trim() });
      if (r.ok) {
        toast.success('Certificación anulada');
        setAnularOpen(false);
        router.refresh();
      } else {
        toast.error(r.error);
      }
    });
  }

  return (
    <>
      <Toaster />
      <div className="flex items-center gap-2">
        {estado === 'borrador' && (
          <Button onClick={handleEmitir} disabled={pending || Number(totalGeneral) === 0} size="sm" className="gap-1.5">
            <Send className="size-4" aria-hidden />
            Emitir
          </Button>
        )}
        {estado === 'emitida' && (
          <CobrarDialog
            certId={certId}
            totalNeto={totalNeto}
            totalHonorarios={totalHonorarios}
            totalGeneral={totalGeneral}
            moneda={moneda}
            cuentas={cuentas}
          />
        )}
        {(estado === 'emitida' || estado === 'cobrada' || estado === 'borrador') && (
          <Button onClick={() => setAnularOpen(true)} disabled={pending} variant="outline" size="sm" className="gap-1.5">
            <Ban className="size-4" aria-hidden />
            Anular
          </Button>
        )}
      </div>

      <Dialog open={anularOpen} onOpenChange={setAnularOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Anular certificación</DialogTitle>
            <DialogDescription>
              {estado === 'cobrada'
                ? 'La certificación está cobrada. Anularla también anulará los 2 movimientos linkeados (cobro neto + honorarios). Esto es reversible: podés volver a crear una nueva certificación con los avances correctos.'
                : 'Anular esta certificación. Solo es visible para histórico (con motivo); el sistema no la cuenta en saldos.'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-1.5">
            <Label htmlFor="anular-motivo">Motivo de la anulación</Label>
            <Input
              id="anular-motivo"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Ej.: error de cálculo, cliente disconforme, etc."
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAnularOpen(false)}>Cancelar</Button>
            <Button onClick={handleAnular} disabled={pending || motivo.trim().length < 3}>
              {pending ? 'Anulando…' : 'Confirmar anulación'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
