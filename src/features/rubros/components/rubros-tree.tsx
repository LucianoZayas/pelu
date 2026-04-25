'use client';
import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { crearRubro, archivarRubro } from '../actions';
import type { RubroNode } from '../queries';

export function RubrosTree({ arbol, planos }: { arbol: RubroNode[]; planos: { id: string; nombre: string }[] }) {
  const [pending, start] = useTransition();
  const [nombre, setNombre] = useState('');
  const [padre, setPadre] = useState<string | null>(null);

  async function handleCreate() {
    start(async () => {
      await crearRubro({ nombre, idPadre: padre, orden: 0, activo: true });
      setNombre('');
      setPadre(null);
    });
  }

  return (
    <div className="space-y-6">
      <form
        className="flex gap-2 items-end"
        action={handleCreate}
      >
        <div>
          <label className="text-sm">Nombre</label>
          <Input value={nombre} onChange={(e) => setNombre(e.target.value)} required />
        </div>
        <div>
          <label className="text-sm">Padre (opcional)</label>
          <Select value={padre ?? ''} onValueChange={(v) => setPadre(v || null)}>
            <SelectTrigger className="w-56"><SelectValue placeholder="Sin padre (raíz)" /></SelectTrigger>
            <SelectContent>
              {planos.map((p) => <SelectItem key={p.id} value={p.id}>{p.nombre}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <Button type="submit" disabled={pending || !nombre}>Agregar</Button>
      </form>

      <ul className="space-y-1">
        {arbol.map((n) => <NodeView key={n.id} node={n} depth={0} />)}
      </ul>
    </div>
  );
}

function NodeView({ node, depth }: { node: RubroNode; depth: number }) {
  return (
    <>
      <li className="flex items-center gap-2" style={{ paddingLeft: depth * 16 }}>
        <span className={node.activo ? '' : 'line-through text-muted-foreground'}>{node.nombre}</span>
        <Button variant="ghost" size="sm" onClick={() => archivarRubro(node.id)}>Archivar</Button>
      </li>
      {node.hijos.map((h) => <NodeView key={h.id} node={h} depth={depth + 1} />)}
    </>
  );
}
