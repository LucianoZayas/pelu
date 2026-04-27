import { redirect } from 'next/navigation';
import { requireRole } from '@/lib/auth/require';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { crearPresupuesto } from '@/features/presupuestos/actions';

export default async function NuevoPresupuestoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireRole('admin');

  async function action(fd: FormData) {
    'use server';
    const r = await crearPresupuesto({
      obraId: id,
      tipo: fd.get('tipo') as 'original' | 'adicional',
      descripcion: String(fd.get('descripcion') ?? '') || null,
      markupDefaultPorcentaje: String(fd.get('markupDefaultPorcentaje') ?? '30'),
      cotizacionUsd: String(fd.get('cotizacionUsd') ?? '1'),
    });
    if (!r.ok) throw new Error(r.error);
    redirect(`/obras/${id}/presupuestos/${r.id}`);
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-6">Nuevo presupuesto</h1>
      <form action={action} className="grid gap-4 max-w-md">
        <div><Label>Tipo</Label>
          <Select name="tipo" defaultValue="original">
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="original">Original</SelectItem>
              <SelectItem value="adicional">Adicional</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div><Label>Descripción (opcional)</Label><Input name="descripcion" /></div>
        <div><Label>Markup default %</Label><Input name="markupDefaultPorcentaje" type="number" step="0.01" defaultValue="30" /></div>
        <div><Label>Cotización USD</Label><Input name="cotizacionUsd" type="number" step="0.0001" required /></div>
        <Button type="submit">Crear</Button>
      </form>
    </div>
  );
}
