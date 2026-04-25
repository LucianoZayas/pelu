'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { ObraInput } from '../schema';

type Props = {
  initial?: Partial<ObraInput & { id: string }>;
  onSubmit: (input: ObraInput) => Promise<{ ok: true; id?: string } | { ok: false; error: string }>;
};

export function ObraForm({ initial, onSubmit }: Props) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handle(formData: FormData) {
    setPending(true);
    setError(null);
    const input = {
      nombre: String(formData.get('nombre') ?? ''),
      clienteNombre: String(formData.get('clienteNombre') ?? ''),
      clienteEmail: String(formData.get('clienteEmail') ?? '') || null,
      clienteTelefono: String(formData.get('clienteTelefono') ?? '') || null,
      ubicacion: String(formData.get('ubicacion') ?? '') || null,
      superficieM2: String(formData.get('superficieM2') ?? '') || null,
      monedaBase: (formData.get('monedaBase') ?? 'USD') as 'USD' | 'ARS',
      cotizacionUsdInicial: String(formData.get('cotizacionUsdInicial') ?? '') || null,
      porcentajeHonorarios: String(formData.get('porcentajeHonorarios') ?? '16'),
    };
    const r = await onSubmit(input as ObraInput);
    setPending(false);
    if (!r.ok) setError(r.error);
    else router.push(r.id ? `/obras/${r.id}` : '/obras');
  }

  return (
    <form action={handle} className="grid grid-cols-2 gap-4 max-w-3xl">
      <Field name="nombre" label="Nombre de la obra" defaultValue={initial?.nombre} required />
      <Field name="clienteNombre" label="Cliente" defaultValue={initial?.clienteNombre} required />
      <Field name="clienteEmail" label="Email cliente" type="email" defaultValue={initial?.clienteEmail ?? ''} />
      <Field name="clienteTelefono" label="Teléfono cliente" defaultValue={initial?.clienteTelefono ?? ''} />
      <Field name="ubicacion" label="Ubicación" defaultValue={initial?.ubicacion ?? ''} />
      <Field name="superficieM2" label="Superficie m²" type="number" step="0.01" defaultValue={initial?.superficieM2 ?? ''} />
      <div>
        <Label htmlFor="monedaBase">Moneda base</Label>
        <Select name="monedaBase" defaultValue={initial?.monedaBase ?? 'USD'}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="USD">USD</SelectItem>
            <SelectItem value="ARS">ARS</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <Field name="cotizacionUsdInicial" label="Cotización USD inicial" type="number" step="0.0001" defaultValue={initial?.cotizacionUsdInicial ?? ''} />
      <Field name="porcentajeHonorarios" label="Honorarios %" type="number" step="0.01" defaultValue={initial?.porcentajeHonorarios ?? '16'} />
      {error && <p className="col-span-2 text-sm text-red-600">{error}</p>}
      <div className="col-span-2 flex gap-2">
        <Button type="submit" disabled={pending}>{pending ? 'Guardando...' : 'Guardar'}</Button>
      </div>
    </form>
  );
}

function Field(props: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  const { label, ...rest } = props;
  return (
    <div>
      <Label htmlFor={rest.name}>{label}</Label>
      <Input id={rest.name} {...rest} />
    </div>
  );
}
