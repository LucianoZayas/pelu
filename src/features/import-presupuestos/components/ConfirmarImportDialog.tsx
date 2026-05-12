'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Check, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { confirmarImportAction } from '@/features/import-presupuestos/actions';

interface Props {
  presupuestoId: string;
  itemsImportados: number;
  itemsConWarning: number;
  descartesCount: number;
  onConfirmed?: () => void;
}

export function ConfirmarImportDialog({
  presupuestoId,
  itemsImportados,
  itemsConWarning,
  descartesCount,
  onConfirmed,
}: Props) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const handleConfirm = () => {
    startTransition(async () => {
      const res = await confirmarImportAction({ presupuestoId });
      if (res.ok) {
        toast.success('Importación confirmada');
        setOpen(false);
        onConfirmed?.();
      } else {
        toast.error(res.error ?? 'Error al confirmar');
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm"><Check className="size-4" /> Confirmar importación</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Confirmar importación</DialogTitle>
          <DialogDescription>
            Vas a confirmar la importación de <strong>{itemsImportados} items</strong>.
            Después de confirmar, el presupuesto pasa a borrador editable normal y queda registrado en auditoría.
          </DialogDescription>
        </DialogHeader>
        {(itemsConWarning > 0 || descartesCount > 0) && (
          <div className="rounded border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 px-3 py-2 text-sm">
            <ul className="space-y-1 text-amber-900 dark:text-amber-100">
              {itemsConWarning > 0 && <li>⚠ {itemsConWarning} items tienen warnings (rubro heredado, costo en 0, etc.)</li>}
              {descartesCount > 0 && <li>⚠ {descartesCount} filas del Excel quedaron afuera</li>}
            </ul>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm} disabled={isPending}>
            {isPending ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
            Confirmar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
