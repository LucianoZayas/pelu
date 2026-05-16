'use client';

import { useState, useTransition } from 'react';
import { Plus, Pencil, Archive, ArchiveRestore, Briefcase, Hammer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Toaster } from '@/components/ui/sonner';
import { cn } from '@/lib/utils';
import { crearProveedor, editarProveedor, archivarProveedor, restaurarProveedor } from '../actions';

type Proveedor = {
  id: string;
  nombre: string;
  cuit: string | null;
  contacto: string | null;
  esContratista: boolean;
  activo: boolean;
};

type FormState = Omit<Proveedor, 'id'> & { id?: string };

const EMPTY: FormState = {
  nombre: '',
  cuit: null,
  contacto: null,
  esContratista: false,
  activo: true,
};

export function ProveedoresManager({ proveedores }: { proveedores: Proveedor[] }) {
  const [pending, startTransition] = useTransition();
  const [showInactive, setShowInactive] = useState(false);
  const [form, setForm] = useState<FormState | null>(null);

  const inactivos = proveedores.filter((p) => !p.activo).length;
  const visibles = showInactive ? proveedores : proveedores.filter((p) => p.activo);

  function openCreate() { setForm({ ...EMPTY }); }
  function openEdit(p: Proveedor) { setForm({ ...p }); }

  function handleSubmit() {
    if (!form || !form.nombre.trim()) return;
    const payload = {
      nombre: form.nombre.trim(),
      cuit: form.cuit?.trim() || null,
      contacto: form.contacto?.trim() || null,
      esContratista: form.esContratista,
      activo: form.activo,
    };
    startTransition(async () => {
      const r = form.id ? await editarProveedor(form.id, payload) : await crearProveedor(payload);
      if (r.ok) {
        toast.success(form.id ? 'Proveedor actualizado' : 'Proveedor creado');
        setForm(null);
      } else {
        toast.error(r.error);
      }
    });
  }

  function handleArchive(id: string, nombre: string) {
    if (!confirm(`¿Archivar "${nombre}"? Los movimientos existentes que lo referencian se mantienen.`)) return;
    startTransition(async () => {
      const r = await archivarProveedor(id);
      if (r.ok) toast.success('Proveedor archivado');
      else toast.error(r.error);
    });
  }

  function handleRestore(id: string) {
    startTransition(async () => {
      const r = await restaurarProveedor(id);
      if (r.ok) toast.success('Proveedor restaurado');
      else toast.error(r.error);
    });
  }

  return (
    <>
      <Toaster />

      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3 text-[13px] text-muted-foreground">
            <span>
              <strong className="text-foreground">{proveedores.length}</strong> proveedor{proveedores.length === 1 ? '' : 'es'}
            </span>
            {inactivos > 0 && (
              <>
                <span className="text-muted-foreground/40">·</span>
                <button
                  type="button"
                  onClick={() => setShowInactive((v) => !v)}
                  className="hover:text-foreground transition-colors"
                >
                  {inactivos} archivado{inactivos === 1 ? '' : 's'} {showInactive ? '(visible)' : '(oculto)'}
                </button>
              </>
            )}
          </div>
          <Button onClick={openCreate} size="sm" className="gap-1.5">
            <Plus className="size-4" aria-hidden />
            Nuevo proveedor
          </Button>
        </div>

        <div className="rounded-xl border bg-card overflow-hidden shadow-[0_1px_2px_rgba(16,24,40,0.04),0_1px_3px_rgba(16,24,40,0.06)]">
          {visibles.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <p className="text-[14px] font-medium">No hay proveedores para mostrar</p>
              <p className="mt-1 text-[13px] text-muted-foreground">
                Creá el primero con &ldquo;Nuevo proveedor&rdquo;.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-secondary/60 hover:bg-secondary/60 border-b">
                  <TableHead className="text-[10.5px] font-semibold uppercase tracking-[0.06em] text-muted-foreground/85">Nombre</TableHead>
                  <TableHead className="text-[10.5px] font-semibold uppercase tracking-[0.06em] text-muted-foreground/85">CUIT</TableHead>
                  <TableHead className="text-[10.5px] font-semibold uppercase tracking-[0.06em] text-muted-foreground/85">Contacto</TableHead>
                  <TableHead className="text-[10.5px] font-semibold uppercase tracking-[0.06em] text-muted-foreground/85">Tipo</TableHead>
                  <TableHead className="text-[10.5px] font-semibold uppercase tracking-[0.06em] text-muted-foreground/85">Estado</TableHead>
                  <TableHead className="w-0" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibles.map((p) => {
                  const Icon = p.esContratista ? Hammer : Briefcase;
                  return (
                    <TableRow
                      key={p.id}
                      className={cn('group hover:bg-secondary/40 transition-colors', !p.activo && 'opacity-60')}
                    >
                      <TableCell className="text-[14px] font-medium flex items-center gap-2">
                        <Icon className="size-3.5 text-muted-foreground" aria-hidden />
                        {p.nombre}
                      </TableCell>
                      <TableCell className="font-mono text-[12.5px] text-muted-foreground">
                        {p.cuit || <span className="text-muted-foreground/50">—</span>}
                      </TableCell>
                      <TableCell className="text-[12.5px] text-muted-foreground max-w-[240px] truncate" title={p.contacto ?? undefined}>
                        {p.contacto || <span className="text-muted-foreground/50">—</span>}
                      </TableCell>
                      <TableCell>
                        {p.esContratista ? (
                          <Badge variant="outline" className="font-normal border-amber-300 bg-amber-50 text-amber-800">
                            Contratista
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="font-normal">Proveedor</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <span
                          className={cn(
                            'inline-flex items-center gap-1.5 text-[12.5px]',
                            p.activo ? 'text-emerald-700' : 'text-muted-foreground',
                          )}
                        >
                          <span
                            className={cn(
                              'size-1.5 rounded-full',
                              p.activo ? 'bg-emerald-500' : 'bg-muted-foreground/50',
                            )}
                            aria-hidden
                          />
                          {p.activo ? 'Activo' : 'Archivado'}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button
                            variant="ghost" size="icon" className="size-7"
                            title="Editar" onClick={() => openEdit(p)}
                          >
                            <Pencil className="size-3.5" aria-hidden />
                            <span className="sr-only">Editar</span>
                          </Button>
                          {p.activo ? (
                            <Button
                              variant="ghost" size="icon" className="size-7"
                              title="Archivar" onClick={() => handleArchive(p.id, p.nombre)}
                            >
                              <Archive className="size-3.5" aria-hidden />
                              <span className="sr-only">Archivar</span>
                            </Button>
                          ) : (
                            <Button
                              variant="ghost" size="icon" className="size-7"
                              title="Restaurar" onClick={() => handleRestore(p.id)}
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
            <DialogTitle>{form?.id ? 'Editar proveedor' : 'Nuevo proveedor'}</DialogTitle>
            <DialogDescription>
              {form?.id
                ? 'Modificá los datos del proveedor o contratista.'
                : 'Cargá un proveedor de materiales o un contratista de mano de obra.'}
            </DialogDescription>
          </DialogHeader>
          {form && (
            <div className="grid gap-4">
              <div className="grid gap-1.5">
                <Label htmlFor="prov-nombre">Nombre</Label>
                <Input
                  id="prov-nombre"
                  value={form.nombre}
                  onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                  placeholder="Ej.: Hierros Norte, Plomero Pérez…"
                  autoFocus
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1.5">
                  <Label htmlFor="prov-cuit">
                    CUIT <span className="text-muted-foreground font-normal text-[11px]">(opcional)</span>
                  </Label>
                  <Input
                    id="prov-cuit"
                    value={form.cuit ?? ''}
                    onChange={(e) => setForm({ ...form, cuit: e.target.value || null })}
                    placeholder="20-12345678-9"
                    className="font-mono"
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="prov-contacto">
                    Contacto <span className="text-muted-foreground font-normal text-[11px]">(opcional)</span>
                  </Label>
                  <Input
                    id="prov-contacto"
                    value={form.contacto ?? ''}
                    onChange={(e) => setForm({ ...form, contacto: e.target.value || null })}
                    placeholder="Teléfono o email"
                  />
                </div>
              </div>
              <label className="flex items-center gap-2.5 text-[13px] rounded-lg border bg-secondary/30 px-3 py-2">
                <Checkbox
                  checked={form.esContratista}
                  onCheckedChange={(v) => setForm({ ...form, esContratista: v === true })}
                />
                <span>
                  Es contratista (mano de obra)
                  <span className="block text-[11px] text-muted-foreground">
                    Marcalo si presta servicios; dejá sin marcar si vende materiales.
                  </span>
                </span>
              </label>
              {form.id && (
                <label className="flex items-center justify-between rounded-lg border bg-secondary/30 px-3 py-2">
                  <span className="text-[13px]">Activo</span>
                  <Checkbox
                    checked={form.activo}
                    onCheckedChange={(v) => setForm({ ...form, activo: v === true })}
                  />
                </label>
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
