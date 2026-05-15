'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { Plus, Pencil, Archive, ArchiveRestore, Building2, User, Users, ExternalLink, Briefcase, Building } from 'lucide-react';
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
import { crearParte, editarParte, archivarParte, restaurarParte } from '../actions';
import { TIPOS_MANUALES, type TipoPartManual } from '../schema';
import type { ParteListItem } from '../queries';

type TipoParte = 'empresa' | 'obra' | 'socio' | 'empleado' | 'proveedor' | 'externo';

type FormState = {
  id?: string;
  tipo: TipoPartManual;
  nombre: string;
  cuit: string;
  contacto: string;
  notas: string;
  activo: boolean;
};

const EMPTY: FormState = {
  tipo: 'externo',
  nombre: '',
  cuit: '',
  contacto: '',
  notas: '',
  activo: true,
};

const TIPO_META: Record<TipoParte, { label: string; Icon: typeof Building2; tone: string }> = {
  empresa:   { label: 'Empresa',   Icon: Building,   tone: 'border-indigo-300 bg-indigo-50 text-indigo-800' },
  obra:      { label: 'Obra',      Icon: Building2,  tone: 'border-blue-300 bg-blue-50 text-blue-800' },
  socio:     { label: 'Socio',     Icon: Users,      tone: 'border-purple-300 bg-purple-50 text-purple-800' },
  empleado:  { label: 'Empleado',  Icon: User,       tone: 'border-emerald-300 bg-emerald-50 text-emerald-800' },
  proveedor: { label: 'Proveedor', Icon: Briefcase,  tone: 'border-amber-300 bg-amber-50 text-amber-800' },
  externo:   { label: 'Externo',   Icon: ExternalLink, tone: 'border-slate-300 bg-slate-50 text-slate-700' },
};

export function PartesManager({ partes }: { partes: ParteListItem[] }) {
  const [pending, startTransition] = useTransition();
  const [showInactive, setShowInactive] = useState(false);
  const [filtroTipo, setFiltroTipo] = useState<TipoParte | 'todos'>('todos');
  const [form, setForm] = useState<FormState | null>(null);

  const inactivas = partes.filter((p) => !p.activo).length;
  const visibles = partes
    .filter((p) => showInactive || p.activo)
    .filter((p) => filtroTipo === 'todos' || p.tipo === filtroTipo);

  function openCreate() { setForm({ ...EMPTY }); }

  function openEdit(p: ParteListItem) {
    if (p.tipo === 'obra' || p.tipo === 'proveedor') {
      toast.error(`Las partes tipo ${p.tipo} se gestionan desde su entidad original.`);
      return;
    }
    const datos = (p.datos ?? {}) as { cuit?: string; contacto?: string; notas?: string };
    setForm({
      id: p.id,
      tipo: p.tipo as TipoPartManual,
      nombre: p.nombre,
      cuit: datos.cuit ?? '',
      contacto: datos.contacto ?? '',
      notas: datos.notas ?? '',
      activo: p.activo,
    });
  }

  function handleSubmit() {
    if (!form || !form.nombre.trim()) return;
    const datos = {
      cuit: form.cuit.trim() || null,
      contacto: form.contacto.trim() || null,
      notas: form.notas.trim() || null,
    };
    const payload = {
      tipo: form.tipo,
      nombre: form.nombre.trim(),
      datos: (datos.cuit || datos.contacto || datos.notas) ? datos : null,
      activo: form.activo,
    };
    startTransition(async () => {
      const r = form.id ? await editarParte(form.id, payload) : await crearParte(payload);
      if (r.ok) {
        toast.success(form.id ? 'Parte actualizada' : 'Parte creada');
        setForm(null);
      } else {
        toast.error(r.error);
      }
    });
  }

  function handleArchive(id: string, nombre: string) {
    if (!confirm(`¿Archivar "${nombre}"?`)) return;
    startTransition(async () => {
      const r = await archivarParte(id);
      if (r.ok) toast.success('Archivada');
      else toast.error(r.error);
    });
  }

  function handleRestore(id: string) {
    startTransition(async () => {
      const r = await restaurarParte(id);
      if (r.ok) toast.success('Restaurada');
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
              <strong className="text-foreground">{partes.length}</strong> parte{partes.length === 1 ? '' : 's'}
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
          <div className="flex items-center gap-2">
            <Select value={filtroTipo} onValueChange={(v) => setFiltroTipo(v as TipoParte | 'todos')}>
              <SelectTrigger className="h-8 text-xs w-[140px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="empresa">Empresas</SelectItem>
                <SelectItem value="obra">Obras</SelectItem>
                <SelectItem value="socio">Socios</SelectItem>
                <SelectItem value="empleado">Empleados</SelectItem>
                <SelectItem value="proveedor">Proveedores</SelectItem>
                <SelectItem value="externo">Externos</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={openCreate} size="sm" className="gap-1.5">
              <Plus className="size-4" aria-hidden />
              Nueva parte
            </Button>
          </div>
        </div>

        <div className="rounded-xl border bg-card overflow-hidden shadow-[0_1px_2px_rgba(16,24,40,0.04),0_1px_3px_rgba(16,24,40,0.06)]">
          {visibles.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <p className="text-[14px] font-medium">No hay partes para mostrar</p>
              <p className="mt-1 text-[13px] text-muted-foreground">Probá ajustar el filtro o crear una nueva.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-secondary/60 hover:bg-secondary/60 border-b">
                  <TableHead className="text-[10.5px] font-semibold uppercase tracking-[0.06em] text-muted-foreground/85">Tipo</TableHead>
                  <TableHead className="text-[10.5px] font-semibold uppercase tracking-[0.06em] text-muted-foreground/85">Nombre</TableHead>
                  <TableHead className="text-[10.5px] font-semibold uppercase tracking-[0.06em] text-muted-foreground/85">Detalle</TableHead>
                  <TableHead className="text-[10.5px] font-semibold uppercase tracking-[0.06em] text-muted-foreground/85">Estado</TableHead>
                  <TableHead className="w-0" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibles.map((p) => {
                  const { Icon, tone, label } = TIPO_META[p.tipo];
                  const datos = (p.datos ?? {}) as { cuit?: string; contacto?: string; notas?: string };
                  const isLinked = p.tipo === 'obra' || p.tipo === 'proveedor';
                  return (
                    <TableRow key={p.id} className={cn('group hover:bg-secondary/40 transition-colors', !p.activo && 'opacity-60')}>
                      <TableCell>
                        <Badge variant="outline" className={cn('font-normal gap-1', tone)}>
                          <Icon className="size-3" aria-hidden />
                          {label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-[14px] font-medium">
                        {p.tipo === 'obra' && p.obraId ? (
                          <Link href={`/obras/${p.obraId}`} className="hover:underline">
                            {p.nombre}
                            {p.obraCodigo && (
                              <span className="text-muted-foreground/60 font-mono text-[11px] ml-1.5">
                                {p.obraCodigo}
                              </span>
                            )}
                          </Link>
                        ) : (
                          p.nombre
                        )}
                      </TableCell>
                      <TableCell className="text-[12.5px] text-muted-foreground">
                        {datos.cuit && <div className="font-mono">CUIT: {datos.cuit}</div>}
                        {datos.contacto && <div className="truncate max-w-[200px]" title={datos.contacto}>{datos.contacto}</div>}
                        {!datos.cuit && !datos.contacto && (
                          <span className="text-muted-foreground/50">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <span
                          className={cn(
                            'inline-flex items-center gap-1.5 text-[12.5px]',
                            p.activo ? 'text-emerald-700' : 'text-muted-foreground',
                          )}
                        >
                          <span className={cn('size-1.5 rounded-full', p.activo ? 'bg-emerald-500' : 'bg-muted-foreground/50')} aria-hidden />
                          {p.activo ? 'Activa' : 'Archivada'}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          {!isLinked && (
                            <Button variant="ghost" size="icon" className="size-7" title="Editar" onClick={() => openEdit(p)}>
                              <Pencil className="size-3.5" aria-hidden />
                              <span className="sr-only">Editar</span>
                            </Button>
                          )}
                          {!isLinked && p.activo && (
                            <Button variant="ghost" size="icon" className="size-7" title="Archivar" onClick={() => handleArchive(p.id, p.nombre)}>
                              <Archive className="size-3.5" aria-hidden />
                              <span className="sr-only">Archivar</span>
                            </Button>
                          )}
                          {!isLinked && !p.activo && (
                            <Button variant="ghost" size="icon" className="size-7" title="Restaurar" onClick={() => handleRestore(p.id)}>
                              <ArchiveRestore className="size-3.5" aria-hidden />
                              <span className="sr-only">Restaurar</span>
                            </Button>
                          )}
                          {isLinked && (
                            <span className="text-[11px] text-muted-foreground/60 italic px-2">
                              gestionada por {p.tipo === 'obra' ? 'Obras' : 'Proveedores'}
                            </span>
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
            <DialogTitle>{form?.id ? 'Editar parte' : 'Nueva parte'}</DialogTitle>
            <DialogDescription>
              Las partes son los orígenes y destinos de los movimientos (la empresa, socios, empleados, externos).
              Obras y proveedores se crean desde sus pantallas dedicadas.
            </DialogDescription>
          </DialogHeader>
          {form && (
            <div className="grid gap-4">
              <div className="grid grid-cols-[140px_1fr] gap-3">
                <div className="grid gap-1.5">
                  <Label htmlFor="parte-tipo">Tipo</Label>
                  <Select value={form.tipo} onValueChange={(v) => setForm({ ...form, tipo: v as TipoPartManual })}>
                    <SelectTrigger id="parte-tipo"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {TIPOS_MANUALES.map((t) => (
                        <SelectItem key={t} value={t}>
                          {TIPO_META[t].label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="parte-nombre">Nombre</Label>
                  <Input
                    id="parte-nombre"
                    value={form.nombre}
                    onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                    placeholder="Ej.: Cris, Dani, Financiera…"
                    autoFocus
                  />
                </div>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="parte-cuit">
                  CUIT <span className="text-muted-foreground font-normal">(opcional)</span>
                </Label>
                <Input
                  id="parte-cuit"
                  value={form.cuit}
                  onChange={(e) => setForm({ ...form, cuit: e.target.value })}
                  placeholder="20-12345678-9"
                  className="font-mono"
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="parte-contacto">
                  Contacto <span className="text-muted-foreground font-normal">(opcional)</span>
                </Label>
                <Input
                  id="parte-contacto"
                  value={form.contacto}
                  onChange={(e) => setForm({ ...form, contacto: e.target.value })}
                  placeholder="Email, teléfono…"
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="parte-notas">
                  Notas <span className="text-muted-foreground font-normal">(opcional)</span>
                </Label>
                <Input
                  id="parte-notas"
                  value={form.notas}
                  onChange={(e) => setForm({ ...form, notas: e.target.value })}
                  placeholder="Cualquier dato adicional"
                />
              </div>
              {form.id && (
                <label className="flex items-center justify-between rounded-lg border bg-secondary/30 px-3 py-2">
                  <span className="text-[13px]">Activa</span>
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
