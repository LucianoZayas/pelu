'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { regenerarTokenCliente } from '../actions';

export function RegenerarTokenButton({
  obraId,
  currentToken,
}: {
  obraId: string;
  currentToken: string;
}) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [token, setToken] = useState(currentToken);
  const [err, setErr] = useState<string | null>(null);

  const url = `${typeof window !== 'undefined' ? window.location.origin : ''}/cliente/${token}`;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline">Link cliente</Button>} />
      <DialogContent>
        <DialogTitle>Link de acceso del cliente</DialogTitle>
        <p className="text-xs text-muted-foreground">
          Compartí este link al cliente. Si lo regenerás, el anterior dejará de funcionar de
          inmediato.
        </p>
        <Input readOnly value={url} onFocus={(e) => e.currentTarget.select()} />
        {err && <p className="text-sm text-red-600">{err}</p>}
        <Button
          variant="destructive"
          disabled={pending}
          onClick={() =>
            start(async () => {
              setErr(null);
              const r = await regenerarTokenCliente(obraId);
              if (r.ok) setToken(r.token);
              else setErr(r.error);
            })
          }
        >
          {pending ? 'Regenerando...' : 'Regenerar (invalida el anterior)'}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
