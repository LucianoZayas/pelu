'use client';

import { useState, useTransition } from 'react';
import { AlertTriangle, Loader2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { cancelarImportAction } from '@/features/import-presupuestos/actions';

interface Props {
  presupuestoId: string;
  obraNombre: string;
  itemsImportados: number;
  esObraNueva: boolean;
  onCancelled?: (redirectTo: string) => void;
}

export function CancelarImportDialog({
  presupuestoId,
  obraNombre,
  itemsImportados,
  esObraNueva,
  onCancelled,
}: Props) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const handleCancel = () => {
    startTransition(async () => {
      const res = await cancelarImportAction({ presupuestoId });

      if (!res.ok) {
        toast.error(res.error ?? 'Error al cancelar');
        return;
      }

      toast.success(
        esObraNueva
          ? 'Importación cancelada, obra eliminada'
          : 'Importación cancelada, presupuesto anterior restaurado'
      );
      setOpen(false);
      onCancelled?.(res.redirectTo);
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="outline" size="sm">
            <Trash2 className="size-4" />
            Cancelar importación
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="size-5 text-destructive" aria-hidden />
            Cancelar importación
          </DialogTitle>
          <DialogDescription>Esta acción no se puede deshacer.</DialogDescription>
        </DialogHeader>
        <div className="space-y-2 text-sm">
          <p>Vas a perder:</p>
          <ul className="list-disc pl-5 text-muted-foreground">
            <li>{itemsImportados} items importados</li>
            <li>Los ajustes que hayas hecho en la grilla</li>
          </ul>
          {esObraNueva ? (
            <p className="mt-2 rounded bg-destructive/10 px-3 py-2 text-destructive">
              También se va a eliminar la obra <strong>{obraNombre}</strong>.
            </p>
          ) : (
            <p className="mt-2 rounded bg-muted px-3 py-2 text-muted-foreground">
              Se restaura el presupuesto anterior de <strong>{obraNombre}</strong>.
            </p>
          )}
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={isPending}
          >
            Volver
          </Button>
          <Button
            variant="destructive"
            onClick={handleCancel}
            disabled={isPending}
          >
            {isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Trash2 className="size-4" />
            )}
            Sí, cancelar importación
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
