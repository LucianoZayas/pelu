'use client';

import { useState, useTransition } from 'react';
import { Plus, Pencil, Archive, ArchiveRestore, Wallet, Landmark } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Toaster } from '@/components/ui/sonner';
import { cn } from '@/lib/utils';
import { crearCuenta, editarCuenta, archivarCuenta, restaurarCuenta } from '../actions';
import type { CuentaConSaldo } from '../queries';

type EditingState = {
  id?: string;
  nombre: string;
  moneda: 'USD' | 'ARS';
  tipo: 'caja' | 'banco';
  orden: number;
  notas: string;
  activo: boolean;
};

const EMPTY_FORM: EditingState = {
  nombre: '',
  moneda: 'ARS',
  tipo: 'caja',
  orden: 0,
  notas: '',
  activo: true,
};

function formatMoney(value: string, moneda: 'USD' | 'ARS'): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return value;
  const formatted = new Intl.NumberFormat('es-AR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
  return `${moneda === 'USD' ? 'US$' : '$'} ${formatted}`;
}

export function CuentasManager({ cuentas }: { cuentas: CuentaConSaldo[] }) {
  const [pending, startTransition] = useTransition();
  const [showInactive, setShowInactive] = useState(false);
  const [form, setForm] = useState<EditingState | null>(null);

  const inactivas = cuentas.filter((c) => !c.activo).length;
  const visibles = showInactive ? cuentas : cuentas.filter((c) => c.activo);

  function openCreate() {
    setForm({ ...EMPTY_FORM });
  }

  function openEdit(c: CuentaConSaldo) {
    setForm({
      id: c.id,
      nombre: c.nombre,
      moneda: c.moneda,
      tipo: (c.tipo === 'banco' ? 'banco' : 'caja'),
      orden: c.orden,
      notas: c.notas ?? '',
      activo: c.activo,
    });
  }

  function handleSubmit() {
    if (!form || !form.nombre.trim()) return;
    const payload = {
      nombre: form.nombre.trim(),
      moneda: form.moneda,
      tipo: form.tipo,
      orden: form.orden,
      notas: form.notas.trim() || null,
      activo: form.activo,
    };
    startTransition(async () => {
      const result = form.id
        ? await editarCuenta(form.id, payload)
        : await crearCuenta(payload);
      if (result.ok) {
        toast.success(form.id ? 'Cuenta actualizada' : 'Cuenta creada');
        setForm(null);
      } else {
        toast.error(result.error);
      }
    });
  }

  function handleArchive(id: string, nombre: string) {
    if (!confirm(`¿Archivar la cuenta "${nombre}"?\nNo se borra; podés restaurarla luego.`)) return;
    startTransition(async () => {
      const r = await archivarCuenta(id);
      if (r.ok) toast.success('Cuenta archivada');
      else toast.error(r.error);
    });
  }

  function handleRestore(id: string) {
    startTransition(async () => {
      const r = await restaurarCuenta(id);
      if (r.ok) toast.success('Cuenta restaurada');
      else toast.error(r.error);
    });
  }

  return (
    <>
      <Toaster />

      <div className="space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4 text-[13px] text-muted-foreground">
            <span>
              <strong className="text-foreground">{cuentas.length}</strong> cuenta{cuentas.length === 1 ? '' : 's'}
            </span>
            {inactivas > 0 && (
              <>
                <span className="text-muted-foreground/40">·</span>
                <button
                  type="button"
                  onClick={() => setShowInactive((v) => !v)}
                  className="hover:text-foreground transition-colors"
                >
                  {inactivas} archivada{inactivas === 1 ? '' : 's'} {showInactive ? '(visible)' : '(oculto)'}
                </button>
              </>
            )}
          </div>
          <Button onClick={openCreate} size="sm" className="gap-1.5">
            <Plus className="size-4" aria-hidden />
            Nueva cuenta
          </Button>
        </div>

        <div className="rounded-xl border bg-card overflow-hidden shadow-[0_1px_2px_rgba(16,24,40,0.04),0_1px_3px_rgba(16,24,40,0.06)]">
          {visibles.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <p className="text-[14px] font-medium">No hay cuentas para mostrar</p>
              <p className="mt-1 text-[13px] text-muted-foreground">
                Creá la primera con &ldquo;Nueva cuenta&rdquo;.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-secondary/60 hover:bg-secondary/60 border-b">
                  <TableHead className="text-[10.5px] font-semibold uppercase tracking-[0.06em] text-muted-foreground/85">Nombre</TableHead>
                  <TableHead className="text-[10.5px] font-semibold uppercase tracking-[0.06em] text-muted-foreground/85">Moneda</TableHead>
                  <TableHead className="text-[10.5px] font-semibold uppercase tracking-[0.06em] text-muted-foreground/85">Tipo</TableHead>
                  <TableHead className="text-[10.5px] font-semibold uppercase tracking-[0.06em] text-muted-foreground/85 text-right">Saldo actual</TableHead>
                  <TableHead className="text-[10.5px] font-semibold uppercase tracking-[0.06em] text-muted-foreground/85">Estado</TableHead>
                  <TableHead className="w-0" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibles.map((c) => {
                  const TipoIcon = c.tipo === 'banco' ? Landmark : Wallet;
                  const saldoNum = Number(c.saldoActual);
                  const isNegative = saldoNum < 0;
                  return (
                    <TableRow
                      key={c.id}
                      className={cn(
                        'group hover:bg-secondary/40 transition-colors',
                        !c.activo && 'opacity-60',
                      )}
                    >
                      <TableCell className="text-[14px] font-medium flex items-center gap-2">
                        <TipoIcon className="size-3.5 text-muted-foreground" aria-hidden />
                        {c.nombre}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="font-mono text-[11px]">
                          {c.moneda}
                        </Badge>
                      </TableCell>
                      <TableCell className="capitalize text-[13px] text-muted-foreground">
                        {c.tipo}
                      </TableCell>
                      <TableCell
                        className={cn(
                          'text-right font-mono tabular-nums text-[13.5px]',
                          isNegative ? 'text-red-600' : 'text-foreground',
                        )}
                        title={isNegative ? 'Saldo negativo' : undefined}
                      >
                        {formatMoney(c.saldoActual, c.moneda)}
                      </TableCell>
                      <TableCell>
                        <span
                          className={cn(
                            'inline-flex items-center gap-1.5 text-[12.5px]',
                            c.activo ? 'text-emerald-700' : 'text-muted-foreground',
                          )}
                        >
                          <span
                            className={cn(
                              'size-1.5 rounded-full',
                              c.activo ? 'bg-emerald-500' : 'bg-muted-foreground/50',
                            )}
                            aria-hidden
                          />
                          {c.activo ? 'Activa' : 'Archivada'}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button
                            variant="ghost" size="icon" className="size-7"
                            title="Editar" onClick={() => openEdit(c)}
                          >
                            <Pencil className="size-3.5" aria-hidden />
                            <span className="sr-only">Editar</span>
                          </Button>
                          {c.activo ? (
                            <Button
                              variant="ghost" size="icon" className="size-7"
                              title="Archivar" onClick={() => handleArchive(c.id, c.nombre)}
                            >
                              <Archive className="size-3.5" aria-hidden />
                              <span className="sr-only">Archivar</span>
                            </Button>
                          ) : (
                            <Button
                              variant="ghost" size="icon" className="size-7"
                              title="Restaurar" onClick={() => handleRestore(c.id)}
                            >
                              <ArchiveRestore className="size-3.5" aria-hidden />
                              <span className="sr-only">Restaurar</span>
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </div>
      </div>

      <Dialog open={form !== null} onOpenChange={(o) => !o && setForm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{form?.id ? 'Editar cuenta' : 'Nueva cuenta'}</DialogTitle>
            <DialogDescription>
              {form?.id
                ? 'Modificá los datos de la cuenta. El saldo se recalcula automáticamente.'
                : 'Definí una caja física o cuenta bancaria que usás en la operación.'}
            </DialogDescription>
          </DialogHeader>
          {form && (
            <div className="grid gap-4">
              <div className="grid gap-1.5">
                <Label htmlFor="cuenta-nombre">Nombre</Label>
                <Input
                  id="cuenta-nombre"
                  value={form.nombre}
                  onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                  placeholder="Ej.: Caja USD, Banco Cris…"
                  autoFocus
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1.5">
                  <Label htmlFor="cuenta-moneda">Moneda</Label>
                  <Select
                    value={form.moneda}
                    onValueChange={(v) => setForm({ ...form, moneda: v as 'USD' | 'ARS' })}
                  >
                    <SelectTrigger id="cuenta-moneda"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ARS">ARS</SelectItem>
                      <SelectItem value="USD">USD</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="cuenta-tipo">Tipo</Label>
                  <Select
                    value={form.tipo}
                    onValueChange={(v) => setForm({ ...form, tipo: v as 'caja' | 'banco' })}
                  >
                    <SelectTrigger id="cuenta-tipo"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="caja">Caja (efectivo)</SelectItem>
                      <SelectItem value="banco">Banco</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-[1fr_120px] gap-3">
                <div className="grid gap-1.5">
                  <Label htmlFor="cuenta-notas">
                    Notas <span className="text-muted-foreground font-normal">(opcional)</span>
                  </Label>
                  <Input
                    id="cuenta-notas"
                    value={form.notas}
                    onChange={(e) => setForm({ ...form, notas: e.target.value })}
                    placeholder="Detalles, CBU, alias…"
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="cuenta-orden">Orden</Label>
                  <Input
                    id="cuenta-orden"
                    type="number"
                    min={0}
                    value={form.orden}
                    onChange={(e) => setForm({ ...form, orden: Number(e.target.value) })}
                  />
                </div>
              </div>
              {form.id && (
                <div className="flex items-center justify-between rounded-lg border bg-secondary/30 px-3 py-2">
                  <div className="grid">
                    <Label htmlFor="cuenta-activo" className="text-[13px]">Activa</Label>
                    <span className="text-[12px] text-muted-foreground">
                      Las cuentas archivadas no aparecen al cargar movimientos.
                    </span>
                  </div>
                  <Checkbox
                    id="cuenta-activo"
                    checked={form.activo}
                    onCheckedChange={(v) => setForm({ ...form, activo: v === true })}
                  />
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setForm(null)}>Cancelar</Button>
            <Button onClick={handleSubmit} disabled={pending || !form?.nombre.trim()}>
              {form?.id ? 'Guardar' : 'Crear'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
