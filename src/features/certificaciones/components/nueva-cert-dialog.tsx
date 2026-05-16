'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { Toaster } from '@/components/ui/sonner';
import { crearCertificacion } from '../actions';

type PresupuestoOption = { id: string; numero: number; tipo: string };

export function NuevaCertDialog({
  obraId,
  presupuestos,
}: {
  obraId: string;
  presupuestos: PresupuestoOption[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [presupuestoId, setPresupuestoId] = useState(presupuestos[0]?.id ?? '');
  const [descripcion, setDescripcion] = useState('');
  const [error, setError] = useState<string | null>(null);

  function handleSubmit() {
    setError(null);
    if (!presupuestoId) {
      setError('Elegí un presupuesto');
      return;
    }
    startTransition(async () => {
      const r = await crearCertificacion({ presupuestoId, descripcion: descripcion.trim() || null });
      if (r.ok) {
        toast.success(`Certificación N° ${r.numero} creada`);
        setOpen(false);
        router.push(`/obras/${obraId}/certificaciones/${r.id}`);
      } else {
        setError(r.error);
      }
    });
  }

  return (
    <>
      <Toaster />
      <Button onClick={() => setOpen(true)} size="sm" className="gap-1.5" disabled={presupuestos.length === 0}>
        <Plus className="size-4" aria-hidden />
        Nueva certificación
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nueva certificación de avance</DialogTitle>
            <DialogDescription>
              Crea una certificación en borrador. Después podés cargar los avances por item y emitirla.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4">
            <div className="grid gap-1.5">
              <Label htmlFor="nc-presupuesto">Presupuesto firmado</Label>
              <Select value={presupuestoId} onValueChange={(v) => setPresupuestoId(v ?? '')}>
                <SelectTrigger id="nc-presupuesto"><SelectValue placeholder="Elegí presupuesto…" /></SelectTrigger>
                <SelectContent>
                  {presupuestos.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      Presupuesto #{p.numero} ({p.tipo})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {presupuestos.length === 0 && (
                <p className="text-[12px] text-muted-foreground">
                  No hay presupuestos firmados en esta obra. Firmá un presupuesto antes de certificar.
                </p>
              )}
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="nc-descripcion">
                Descripción <span className="text-muted-foreground font-normal text-[11px]">(opcional)</span>
              </Label>
              <Input
                id="nc-descripcion"
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                placeholder="Ej.: Certificación mayo 2026"
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
            <Button onClick={handleSubmit} disabled={pending || !presupuestoId}>
              {pending ? 'Creando…' : 'Crear borrador'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
