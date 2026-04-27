'use client';
import { memo } from 'react';
import { Controller, useFormContext } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';

type Props = {
  rubroIdx: number;
  itemIdx: number;
  onRemove: () => void;
  rubrosOptions: { id: string; nombre: string }[];
  disabled: boolean;
};

export const ItemRow = memo(function ItemRow({ rubroIdx, itemIdx, onRemove, disabled }: Props) {
  const { register, control } = useFormContext();
  const path = `rubros.${rubroIdx}.items.${itemIdx}` as const;
  return (
    <tr className="border-b">
      <td className="p-1"><Input {...register(`${path}.descripcion` as const)} disabled={disabled} className="h-8" /></td>
      <td className="p-1 w-20"><Input type="number" step="0.0001" {...register(`${path}.cantidad` as const)} disabled={disabled} className="h-8" /></td>
      <td className="p-1 w-16">
        <Controller name={`${path}.unidad` as const} control={control} render={({ field }) => (
          <Select value={field.value} onValueChange={field.onChange} disabled={disabled}>
            <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
            <SelectContent>
              {(['m2','m3','hs','gl','u','ml','kg'] as const).map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
            </SelectContent>
          </Select>
        )} />
      </td>
      <td className="p-1 w-24"><Input type="number" step="0.0001" {...register(`${path}.costoUnitario` as const)} disabled={disabled} className="h-8" /></td>
      <td className="p-1 w-16">
        <Controller name={`${path}.costoUnitarioMoneda` as const} control={control} render={({ field }) => (
          <Select value={field.value} onValueChange={field.onChange} disabled={disabled}>
            <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="USD">USD</SelectItem>
              <SelectItem value="ARS">ARS</SelectItem>
            </SelectContent>
          </Select>
        )} />
      </td>
      <td className="p-1 w-20"><Input type="number" step="0.01" placeholder="default" {...register(`${path}.markupPorcentaje` as const)} disabled={disabled} className="h-8" /></td>
      <td className="p-1">
        <Button type="button" variant="ghost" size="sm" onClick={onRemove} disabled={disabled}>×</Button>
      </td>
    </tr>
  );
});
