'use client';

import { useState, useTransition, useMemo } from 'react';
import {
  ChevronRight,
  Folder,
  FolderOpen,
  Pencil,
  Archive,
  ArchiveRestore,
  AlertTriangle,
  Plus,
  ArrowDownAZ,
  ListOrdered,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Toaster } from '@/components/ui/sonner';
import { crearRubro, archivarRubro, editarRubro } from '../actions';
import type { RubroNode } from '../queries';

interface RubroFlat {
  id: string;
  nombre: string;
}

interface Issue {
  type: 'whitespace' | 'case_dup';
  message: string;
  suggestion?: string;
}

function detectWhitespace(nombre: string): Issue | null {
  if (nombre !== nombre.trim()) {
    return {
      type: 'whitespace',
      message: `El nombre tiene espacios al inicio o final: "${nombre}"`,
      suggestion: nombre.trim(),
    };
  }
  if (/\s{2,}/.test(nombre)) {
    return {
      type: 'whitespace',
      message: 'El nombre tiene espacios duplicados internos',
      suggestion: nombre.replace(/\s+/g, ' '),
    };
  }
  return null;
}

function detectCaseDup(
  nombre: string,
  allNames: string[],
): { twin: string } | null {
  const norm = nombre.trim().toLocaleLowerCase('es-AR');
  const twins = allNames.filter(
    (n) => n !== nombre && n.trim().toLocaleLowerCase('es-AR') === norm,
  );
  if (twins.length === 0) return null;
  return { twin: twins[0] };
}

function countNodes(nodes: RubroNode[]): number {
  return nodes.reduce((acc, n) => acc + 1 + countNodes(n.hijos), 0);
}

function countInactive(nodes: RubroNode[]): number {
  return nodes.reduce(
    (acc, n) => acc + (n.activo ? 0 : 1) + countInactive(n.hijos),
    0,
  );
}

/**
 * Devuelve una copia del árbol ordenada alfabéticamente por nombre,
 * aplicando el orden recursivamente a cada nivel de hijos. Usa locale 'es-AR'
 * con sensitivity 'base' para que "Albañilería" y "ALBAÑILERIA" se comparen
 * sin tener en cuenta tildes ni mayúsculas.
 */
function sortTreeAlpha(nodes: RubroNode[]): RubroNode[] {
  const collator = new Intl.Collator('es-AR', { sensitivity: 'base' });
  const sorted = [...nodes].sort((a, b) => collator.compare(a.nombre, b.nombre));
  return sorted.map((n) => ({ ...n, hijos: sortTreeAlpha(n.hijos) }));
}

export function RubrosTree({
  arbol,
  planos,
}: {
  arbol: RubroNode[];
  planos: RubroFlat[];
}) {
  const [pending, startTransition] = useTransition();
  const [nombre, setNombre] = useState('');
  const [padre, setPadre] = useState<string | null>(null);
  const [showInactive, setShowInactive] = useState(false);
  const [editing, setEditing] = useState<{ id: string; nombre: string } | null>(null);
  const [editValue, setEditValue] = useState('');
  const [sortMode, setSortMode] = useState<'manual' | 'alpha'>('manual');

  const allNames = useMemo(() => planos.map((p) => p.nombre), [planos]);
  const arbolOrdenado = useMemo(
    () => (sortMode === 'alpha' ? sortTreeAlpha(arbol) : arbol),
    [arbol, sortMode],
  );
  const totalRubros = countNodes(arbol);
  const inactivosCount = countInactive(arbol);

  function handleCreate() {
    if (!nombre.trim()) return;
    startTransition(async () => {
      const r = await crearRubro({
        nombre: nombre.trim(),
        idPadre: padre,
        orden: 0,
        activo: true,
      });
      if (r.ok) {
        toast.success(`Rubro "${nombre.trim()}" creado`);
        setNombre('');
        setPadre(null);
      } else {
        toast.error(r.error);
      }
    });
  }

  function handleArchive(id: string, nombreItem: string) {
    if (!confirm(`¿Archivar el rubro "${nombreItem}"?`)) return;
    startTransition(async () => {
      const r = await archivarRubro(id);
      if (r.ok) toast.success('Rubro archivado');
      else toast.error(r.error);
    });
  }

  function handleRestore(id: string) {
    startTransition(async () => {
      const r = await editarRubro(id, { activo: true });
      if (r.ok) toast.success('Rubro restaurado');
      else toast.error(r.error);
    });
  }

  function openEdit(id: string, nombreItem: string) {
    setEditing({ id, nombre: nombreItem });
    setEditValue(nombreItem);
  }

  function handleEditSave() {
    if (!editing || !editValue.trim()) return;
    const e = editing;
    startTransition(async () => {
      const r = await editarRubro(e.id, { nombre: editValue.trim() });
      if (r.ok) {
        toast.success(`Rubro renombrado a "${editValue.trim()}"`);
        setEditing(null);
        setEditValue('');
      } else {
        toast.error(r.error);
      }
    });
  }

  function handleNormalize(id: string, suggested: string) {
    startTransition(async () => {
      const r = await editarRubro(id, { nombre: suggested });
      if (r.ok) toast.success(`Normalizado a "${suggested}"`);
      else toast.error(r.error);
    });
  }

  return (
    <>
      <Toaster />

      <div className="space-y-6">
        <div className="flex items-center gap-4 text-[13px] text-muted-foreground">
          <span>
            <strong className="text-foreground">{totalRubros}</strong> rubros en total
          </span>
          {inactivosCount > 0 && (
            <>
              <span className="text-muted-foreground/40">·</span>
              <button
                type="button"
                onClick={() => setShowInactive((v) => !v)}
                className="hover:text-foreground transition-colors"
              >
                {inactivosCount} archivado{inactivosCount === 1 ? '' : 's'}{' '}
                {showInactive ? '(visible)' : '(oculto)'}
              </button>
            </>
          )}
        </div>

        {/* Create form */}
        <div className="rounded-xl border bg-card p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04),0_1px_3px_rgba(16,24,40,0.06)]">
          <div className="flex items-center gap-2 mb-4">
            <Plus className="size-4 text-muted-foreground" aria-hidden />
            <h2 className="text-[14px] font-semibold">Crear rubro</h2>
          </div>
          <form
            className="grid grid-cols-1 sm:grid-cols-[1fr_280px_auto] gap-3 items-end"
            action={handleCreate}
          >
            <div className="grid gap-1.5">
              <Label htmlFor="rubro-nombre">Nombre</Label>
              <Input
                id="rubro-nombre"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="Ej.: Albañilería"
                required
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="rubro-padre">
                Padre <span className="text-muted-foreground font-normal">(opcional)</span>
              </Label>
              <Select
                value={padre ?? '__root__'}
                onValueChange={(v) => setPadre(v === '__root__' ? null : v)}
              >
                <SelectTrigger id="rubro-padre">
                  <SelectValue placeholder="Sin padre (raíz)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__root__">Sin padre (raíz)</SelectItem>
                  {planos.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button type="submit" disabled={pending || !nombre.trim()} size="sm">
              Agregar
            </Button>
          </form>
        </div>

        {/* Tree */}
        <div className="rounded-xl border bg-card shadow-[0_1px_2px_rgba(16,24,40,0.04),0_1px_3px_rgba(16,24,40,0.06)] overflow-hidden">
          <div className="px-5 py-3 border-b bg-muted/30 flex items-center justify-between gap-3">
            <h2 className="text-[14px] font-semibold">Catálogo</h2>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 text-xs gap-1.5"
              onClick={() => setSortMode((m) => (m === 'alpha' ? 'manual' : 'alpha'))}
              title={
                sortMode === 'alpha'
                  ? 'Restaurar orden original'
                  : 'Ordenar alfabéticamente'
              }
            >
              {sortMode === 'alpha' ? (
                <>
                  <ListOrdered className="size-3.5" aria-hidden />
                  Orden original
                </>
              ) : (
                <>
                  <ArrowDownAZ className="size-3.5" aria-hidden />
                  Ordenar A→Z
                </>
              )}
            </Button>
          </div>
          {arbolOrdenado.length === 0 ? (
            <div className="px-5 py-12 text-center text-sm text-muted-foreground">
              No hay rubros todavía. Creá el primero arriba.
            </div>
          ) : (
            <ul className="divide-y">
              {arbolOrdenado.map((n) => (
                <NodeView
                  key={n.id}
                  node={n}
                  depth={0}
                  showInactive={showInactive}
                  allNames={allNames}
                  onEdit={openEdit}
                  onArchive={handleArchive}
                  onRestore={handleRestore}
                  onNormalize={handleNormalize}
                />
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Edit dialog */}
      <Dialog
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Renombrar rubro</DialogTitle>
            <DialogDescription>
              Estás renombrando &ldquo;{editing?.nombre}&rdquo;. Todos los items que usan
              este rubro mantienen el vínculo.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-1.5">
            <Label htmlFor="edit-rubro-nombre">Nuevo nombre</Label>
            <Input
              id="edit-rubro-nombre"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>
              Cancelar
            </Button>
            <Button
              onClick={handleEditSave}
              disabled={
                pending ||
                !editValue.trim() ||
                editValue.trim() === editing?.nombre
              }
            >
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function NodeView({
  node,
  depth,
  showInactive,
  allNames,
  onEdit,
  onArchive,
  onRestore,
  onNormalize,
}: {
  node: RubroNode;
  depth: number;
  showInactive: boolean;
  allNames: string[];
  onEdit: (id: string, nombre: string) => void;
  onArchive: (id: string, nombre: string) => void;
  onRestore: (id: string) => void;
  onNormalize: (id: string, suggested: string) => void;
}) {
  if (!node.activo && !showInactive) {
    return null;
  }

  const whitespaceIssue = detectWhitespace(node.nombre);
  const caseDup = detectCaseDup(node.nombre, allNames);

  const hasChildren = node.hijos.length > 0;
  const Icon = hasChildren ? FolderOpen : Folder;

  return (
    <>
      <li
        className={`group flex items-center gap-2 px-5 py-2.5 hover:bg-muted/30 transition-colors ${
          !node.activo ? 'opacity-60' : ''
        }`}
      >
        {/* Indentation guides */}
        {depth > 0 && (
          <div className="flex items-stretch" aria-hidden>
            {Array.from({ length: depth }).map((_, i) => (
              <div
                key={i}
                className="w-5 border-l border-dashed border-muted-foreground/20"
              />
            ))}
            <ChevronRight className="size-3.5 text-muted-foreground/40 self-center -ml-1.5" />
          </div>
        )}
        <Icon
          className={`size-4 shrink-0 ${
            hasChildren ? 'text-primary/70' : 'text-muted-foreground/70'
          }`}
          aria-hidden
        />

        {/* Nombre */}
        <span
          className={`text-[14px] ${
            node.activo ? '' : 'line-through text-muted-foreground'
          }`}
        >
          {node.nombre}
        </span>

        {/* Issue chips */}
        {whitespaceIssue && (
          <Badge
            variant="outline"
            title={
              whitespaceIssue.message +
              (whitespaceIssue.suggestion ? ` → "${whitespaceIssue.suggestion}"` : '')
            }
            className="bg-yellow-50 border-yellow-300 text-yellow-800 text-[10.5px] font-normal gap-1 cursor-help"
          >
            <AlertTriangle className="size-3" aria-hidden />
            espacios
          </Badge>
        )}

        {caseDup && (
          <Badge
            variant="outline"
            title={`Otro rubro con el mismo nombre con diferente capitalización: "${caseDup.twin}"`}
            className="bg-orange-50 border-orange-300 text-orange-800 text-[10.5px] font-normal gap-1 cursor-help"
          >
            <AlertTriangle className="size-3" aria-hidden />
            duplicado
          </Badge>
        )}

        {!node.activo && (
          <Badge variant="secondary" className="text-[10.5px] font-normal">
            archivado
          </Badge>
        )}

        {/* Actions */}
        <div className="ml-auto flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {whitespaceIssue?.suggestion && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              title={`Renombrar a "${whitespaceIssue.suggestion}"`}
              onClick={() => onNormalize(node.id, whitespaceIssue.suggestion!)}
            >
              Normalizar
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="size-7"
            title="Renombrar"
            onClick={() => onEdit(node.id, node.nombre)}
          >
            <Pencil className="size-3.5" aria-hidden />
            <span className="sr-only">Renombrar</span>
          </Button>
          {node.activo ? (
            <Button
              variant="ghost"
              size="icon"
              className="size-7"
              title="Archivar"
              onClick={() => onArchive(node.id, node.nombre)}
            >
              <Archive className="size-3.5" aria-hidden />
              <span className="sr-only">Archivar</span>
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="icon"
              className="size-7"
              title="Restaurar"
              onClick={() => onRestore(node.id)}
            >
              <ArchiveRestore className="size-3.5" aria-hidden />
              <span className="sr-only">Restaurar</span>
            </Button>
          )}
        </div>
      </li>
      {node.hijos.map((h) => (
        <NodeView
          key={h.id}
          node={h}
          depth={depth + 1}
          showInactive={showInactive}
          allNames={allNames}
          onEdit={onEdit}
          onArchive={onArchive}
          onRestore={onRestore}
          onNormalize={onNormalize}
        />
      ))}
    </>
  );
}
