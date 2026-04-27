'use client';
import { useRouter, useSearchParams } from 'next/navigation';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { buttonVariants } from '@/components/ui/button';
import { Label } from '@/components/ui/label';

export function AuditoriaFiltros() {
  const router = useRouter();
  const sp = useSearchParams();

  const ALL = '__all__';

  function update(key: string, val: string | null) {
    const next = new URLSearchParams(sp);
    if (val && val !== ALL) next.set(key, val); else next.delete(key);
    router.push(`?${next.toString()}`);
  }

  return (
    <div className="flex gap-3 items-end mb-4">
      <div>
        <Label>Entidad</Label>
        <Select value={sp.get('entidad') ?? ALL} onValueChange={(v) => update('entidad', v)}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Todas" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todas</SelectItem>
            <SelectItem value="obra">Obra</SelectItem>
            <SelectItem value="presupuesto">Presupuesto</SelectItem>
            <SelectItem value="usuario">Usuario</SelectItem>
            <SelectItem value="cliente_token">Token cliente</SelectItem>
            <SelectItem value="rubro">Rubro</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label>Acción</Label>
        <Select value={sp.get('accion') ?? ALL} onValueChange={(v) => update('accion', v)}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Todas" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todas</SelectItem>
            <SelectItem value="crear">Crear</SelectItem>
            <SelectItem value="editar">Editar</SelectItem>
            <SelectItem value="firmar">Firmar</SelectItem>
            <SelectItem value="cancelar">Cancelar</SelectItem>
            <SelectItem value="eliminar">Eliminar</SelectItem>
            <SelectItem value="regenerar_token">Regenerar token</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label>Desde</Label>
        <Input type="date" defaultValue={sp.get('desde') ?? ''} onBlur={(e) => update('desde', e.target.value)} />
      </div>
      <div>
        <Label>Hasta</Label>
        <Input type="date" defaultValue={sp.get('hasta') ?? ''} onBlur={(e) => update('hasta', e.target.value)} />
      </div>
      <a href={`/api/export/auditoria?${sp.toString()}`} className={buttonVariants({ variant: 'outline' })}>Exportar XLSX</a>
    </div>
  );
}
