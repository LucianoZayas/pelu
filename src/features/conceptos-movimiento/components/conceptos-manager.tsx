'use client';

import { useState, useTransition } from 'react';
import { Plus, Pencil, Archive, ArchiveRestore, ArrowDownToLine, ArrowUpFromLine, ArrowLeftRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
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
import { crearConcepto, editarConcepto, archivarConcepto, restaurarConcepto } from '../actions';

type TipoConcepto = 'ingreso' | 'egreso' | 'transferencia';

type Concepto = {
  id: string;
  codigo: string;
  nombre: string;
  tipo: TipoConcepto;
  requiereObra: boolean;
  requiereProveedor: boolean;
  esNoRecuperable: boolean;
  orden: number;
  activo: boolean;
};

type FormState = Omit<Concepto, 'id'> & { id?: string };

const EMPTY: FormState = {
  codigo: '',
  nombre: '',
  tipo: 'egreso',
  requiereObra: false,
  requiereProveedor: false,
  esNoRecuperable: false,
  orden: 0,
  activo: true,
};

const TIPO_META: Record<TipoConcepto, { label: string; Icon: typeof ArrowDownToLine; tone: string }> = {
  ingreso:       { label: 'Ingreso',       Icon: ArrowDownToLine,  tone: 'border-emerald-300 bg-emerald-50 text-emerald-800' },
  egreso:        { label: 'Egreso',        Icon: ArrowUpFromLine,  tone: 'border-red-300 bg-red-50 text-red-800' },
  transferencia: { label: 'Transferencia', Icon: ArrowLeftRight,   tone: 'border-blue-300 bg-blue-50 text-blue-800' },
};

export function ConceptosManager({ conceptos }: { conceptos: Concepto[] }) {
  const [pending, startTransition] = useTransition();
  const [showInactive, setShowInactive] = useState(false);
  const [form, setForm] = useState<FormState | null>(null);
  const [filtroTipo, setFiltroTipo] = useState<TipoConcepto | 'todos'>('todos');

  const inactivos = conceptos.filter((c) => !c.activo).length;
  const visibles = conceptos
    .filter((c) => showInactive || c.activo)
    .filter((c) => filtroTipo === 'todos' || c.tipo === filtroTipo);

  function openCreate() { setForm({ ...EMPTY }); }
  function openEdit(c: Concepto) { setForm({ ...c }); }

  function handleSubmit() {
    if (!form || !form.codigo.trim() || !form.nombre.trim()) return;
    const payload = {
      codigo: form.codigo.trim().toUpperCase(),
      nombre: form.nombre.trim(),
      tipo: form.tipo,
      requiereObra: form.requiereObra,
      requiereProveedor: form.requiereProveedor,
      esNoRecuperable: form.esNoRecuperable,
      orden: form.orden,
      activo: form.activo,
    };
    startTransition(async () => {
      const r = form.id ? await editarConcepto(form.id, payload) : await crearConcepto(payload);
      if (r.ok) {
        toast.success(form.id ? 'Concepto actualizado' : 'Concepto creado');
        setForm(null);
      } else {
        toast.error(r.error);
      }
    });
  }

  function handleArchive(id: string, nombre: string) {
    if (!confirm(`¿Archivar el concepto "${nombre}"?\nLos movimientos existentes que lo usan se mantienen.`)) return;
    startTransition(async () => {
      const r = await archivarConcepto(id);
      if (r.ok) toast.success('Concepto archivado');
      else toast.error(r.error);
    });
  }

  function handleRestore(id: string) {
    startTransition(async () => {
      const r = await restaurarConcepto(id);
      if (r.ok) toast.success('Concepto restaurado');
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
              <strong className="text-foreground">{conceptos.length}</strong> concepto{conceptos.length === 1 ? '' : 's'}
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
          <div className="flex items-center gap-2">
            <Select value={filtroTipo} onValueChange={(v) => setFiltroTipo(v as TipoConcepto | 'todos')}>
              <SelectTrigger className="h-8 text-xs w-[140px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="ingreso">Ingresos</SelectItem>
                <SelectItem value="egreso">Egresos</SelectItem>
                <SelectItem value="transferencia">Transferencias</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={openCreate} size="sm" className="gap-1.5">
              <Plus className="size-4" aria-hidden />
              Nuevo concepto
            </Button>
          </div>
        </div>

        <div className="rounded-xl border bg-card overflow-hidden shadow-[0_1px_2px_rgba(16,24,40,0.04),0_1px_3px_rgba(16,24,40,0.06)]">
          {visibles.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <p className="text-[14px] font-medium">No hay conceptos para mostrar</p>
              <p className="mt-1 text-[13px] text-muted-foreground">Ajustá el filtro o creá uno nuevo.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-secondary/60 hover:bg-secondary/60 border-b">
                  <TableHead className="text-[10.5px] font-semibold uppercase tracking-[0.06em] text-muted-foreground/85">Código</TableHead>
                  <TableHead className="text-[10.5px] font-semibold uppercase tracking-[0.06em] text-muted-foreground/85">Nombre</TableHead>
                  <TableHead className="text-[10.5px] font-semibold uppercase tracking-[0.06em] text-muted-foreground/85">Tipo</TableHead>
                  <TableHead className="text-[10.5px] font-semibold uppercase tracking-[0.06em] text-muted-foreground/85">Requiere</TableHead>
                  <TableHead className="text-[10.5px] font-semibold uppercase tracking-[0.06em] text-muted-foreground/85">Estado</TableHead>
                  <TableHead className="w-0" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibles.map((c) => {
                  const { Icon, tone, label } = TIPO_META[c.tipo];
                  return (
                    <TableRow
                      key={c.id}
                      className={cn('group hover:bg-secondary/40 transition-colors', !c.activo && 'opacity-60')}
                    >
                      <TableCell className="font-mono text-[12.5px] uppercase">{c.codigo}</TableCell>
                      <TableCell className="text-[14px] font-medium">{c.nombre}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={cn('font-normal gap-1', tone)}>
                          <Icon className="size-3" aria-hidden />
                          {label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-[12px] text-muted-foreground">
                        <div className="flex flex-wrap gap-1">
                          {c.requiereObra && <Badge variant="outline" className="font-normal">obra</Badge>}
                          {c.requiereProveedor && <Badge variant="outline" className="font-normal">proveedor</Badge>}
                          {c.esNoRecuperable && (
                            <Badge variant="outline" className="font-normal border-orange-300 bg-orange-50 text-orange-800">
                              no recuperable
                            </Badge>
                          )}
                          {!c.requiereObra && !c.requiereProveedor && !c.esNoRecuperable && (
                            <span className="text-muted-foreground/60">—</span>
                          )}
                        </div>
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
                          {c.activo ? 'Activo' : 'Archivado'}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button variant="ghost" size="icon" className="size-7" title="Editar" onClick={() => openEdit(c)}>
                            <Pencil className="size-3.5" aria-hidden />
                            <span className="sr-only">Editar</span>
                          </Button>
                          {c.activo ? (
                            <Button variant="ghost" size="icon" className="size-7" title="Archivar" onClick={() => handleArchive(c.id, c.nombre)}>
                              <Archive className="size-3.5" aria-hidden />
                              <span className="sr-only">Archivar</span>
                            </Button>
                          ) : (
                            <Button variant="ghost" size="icon" className="size-7" title="Restaurar" onClick={() => handleRestore(c.id)}>
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
            <DialogTitle>{form?.id ? 'Editar concepto' : 'Nuevo concepto'}</DialogTitle>
            <DialogDescription>
              Los conceptos categorizan tus movimientos (Honorarios, Sueldo, etc.). Definí qué campos exige cada tipo.
            </DialogDescription>
          </DialogHeader>
          {form && (
            <div className="grid gap-4">
              <div className="grid grid-cols-[140px_1fr] gap-3">
                <div className="grid gap-1.5">
                  <Label htmlFor="cm-codigo">Código</Label>
                  <Input
                    id="cm-codigo"
                    value={form.codigo}
                    onChange={(e) => setForm({ ...form, codigo: e.target.value.toUpperCase() })}
                    placeholder="HO"
                    className="font-mono uppercase"
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="cm-nombre">Nombre</Label>
                  <Input
                    id="cm-nombre"
                    value={form.nombre}
                    onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                    placeholder="Honorarios de Obra"
                    autoFocus
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1.5">
                  <Label htmlFor="cm-tipo">Tipo</Label>
                  <Select value={form.tipo} onValueChange={(v) => setForm({ ...form, tipo: v as TipoConcepto })}>
                    <SelectTrigger id="cm-tipo"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ingreso">Ingreso</SelectItem>
                      <SelectItem value="egreso">Egreso</SelectItem>
                      <SelectItem value="transferencia">Transferencia</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="cm-orden">Orden</Label>
                  <Input
                    id="cm-orden"
                    type="number"
                    min={0}
                    value={form.orden}
                    onChange={(e) => setForm({ ...form, orden: Number(e.target.value) })}
                  />
                </div>
              </div>
              <div className="grid gap-2 rounded-lg border bg-secondary/30 px-3 py-3">
                <div className="text-[12px] text-muted-foreground mb-1">Campos requeridos al cargar el movimiento:</div>
                <label className="flex items-center gap-2 text-[13.5px]">
                  <Checkbox
                    checked={form.requiereObra}
                    onCheckedChange={(v) => setForm({ ...form, requiereObra: v === true })}
                  />
                  Requiere obra
                </label>
                <label className="flex items-center gap-2 text-[13.5px]">
                  <Checkbox
                    checked={form.requiereProveedor}
                    onCheckedChange={(v) => setForm({ ...form, requiereProveedor: v === true })}
                  />
                  Requiere proveedor
                </label>
                <label className="flex items-center gap-2 text-[13.5px]">
                  <Checkbox
                    checked={form.esNoRecuperable}
                    onCheckedChange={(v) => setForm({ ...form, esNoRecuperable: v === true })}
                  />
                  Es no recuperable (gasto que la empresa absorbe)
                </label>
              </div>
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
            <Button onClick={handleSubmit} disabled={pending || !form?.codigo.trim() || !form?.nombre.trim()}>
              {form?.id ? 'Guardar' : 'Crear'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
