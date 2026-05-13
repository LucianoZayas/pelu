import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { requireRole } from '@/lib/auth/require';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { crearPresupuesto } from '@/features/presupuestos/actions';
import { PageHeader } from '@/components/page-header';

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
    <div className="px-8 py-7 max-w-[720px]">
      <Link
        href={`/obras/${id}`}
        className="inline-flex items-center gap-1 text-[12.5px] text-muted-foreground hover:text-foreground transition-colors mb-3"
      >
        <ArrowLeft className="size-3.5" /> Volver a la obra
      </Link>
      <PageHeader
        kicker="Crear"
        title="Nuevo presupuesto"
        description="Definí el tipo (original o adicional) y los valores base. Después se completa con items."
      />
      <form
        action={action}
        className="rounded-xl border bg-card p-6 shadow-[0_1px_2px_rgba(16,24,40,0.04),0_1px_3px_rgba(16,24,40,0.06)] space-y-4"
      >
        <div className="grid gap-1.5">
          <Label htmlFor="tipo">Tipo</Label>
          <Select name="tipo" defaultValue="original">
            <SelectTrigger id="tipo">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="original">Original</SelectItem>
              <SelectItem value="adicional">Adicional</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="descripcion">Descripción <span className="text-muted-foreground font-normal">(opcional)</span></Label>
          <Input id="descripcion" name="descripcion" placeholder="Ej.: Cambios en cocina + sanitarios" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="markupDefaultPorcentaje">Markup default %</Label>
            <Input
              id="markupDefaultPorcentaje"
              name="markupDefaultPorcentaje"
              type="number"
              step="0.01"
              defaultValue="30"
              inputMode="decimal"
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="cotizacionUsd">Cotización USD <span className="text-destructive">*</span></Label>
            <Input
              id="cotizacionUsd"
              name="cotizacionUsd"
              type="number"
              step="0.0001"
              required
              inputMode="decimal"
              placeholder="1500"
            />
          </div>
        </div>
        <div className="flex items-center justify-end pt-2 border-t -mx-6 px-6 -mb-6 pb-6 mt-6">
          <Button type="submit" size="sm">Crear presupuesto</Button>
        </div>
      </form>
    </div>
  );
}
