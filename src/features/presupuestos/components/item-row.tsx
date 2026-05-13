'use client';
import { memo } from 'react';
import { Controller, useFormContext, useWatch } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { ImportRowStatus } from '@/features/import-presupuestos/components/ImportRowStatus';

type ImportWarning = { tipo: string; mensaje: string };
type ImportNotasResult = {
  filaExcel: number;
  estado: 'ok' | 'warning' | 'error';
  warnings: ImportWarning[];
};

function parseImportNotas(notas: string | null): ImportNotasResult | null {
  if (!notas) return null;
  const filaMatch = notas.match(/Import XLSX fila (\d+)/);
  if (!filaMatch) return null;
  const filaExcel = Number(filaMatch[1]);

  const warningMatch = notas.match(/^\[import\] (.+?) \|/);
  if (!warningMatch) {
    return { filaExcel, estado: 'ok', warnings: [] };
  }
  const warnings: ImportWarning[] = warningMatch[1].split('; ').map((mensaje) => {
    if (/no es num[ée]rico|costo/i.test(mensaje)) return { tipo: 'costo_invalido', mensaje };
    if (/REF|f[oó]rmula/i.test(mensaje)) return { tipo: 'ref_error', mensaje };
    if (/heredado/i.test(mensaje)) return { tipo: 'rubro_heredado', mensaje };
    return { tipo: 'unknown', mensaje };
  });
  const estado: 'error' | 'warning' = warnings.some(
    (w) => w.tipo === 'costo_invalido' || w.tipo === 'ref_error'
  ) ? 'error' : 'warning';
  return { filaExcel, estado, warnings };
}

type Props = {
  rubroIdx: number;
  itemIdx: number;
  onRemove: () => void;
  rubrosOptions: { id: string; nombre: string }[];
  disabled: boolean;
  importPendiente: boolean;
};

export const ItemRow = memo(function ItemRow({ rubroIdx, itemIdx, onRemove, disabled, importPendiente }: Props) {
  const { register, control } = useFormContext();
  const path = `rubros.${rubroIdx}.items.${itemIdx}` as const;
  const notas = useWatch({ control, name: `${path}.notas` as const }) as string | null;
  const importStatus = importPendiente ? parseImportNotas(notas) : null;

  return (
    <tr className="border-b">
      {importPendiente && (
        <td className="p-1 w-20">
          {importStatus && (
            <ImportRowStatus
              filaExcel={importStatus.filaExcel}
              estado={importStatus.estado}
              warnings={importStatus.warnings}
            />
          )}
        </td>
      )}
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
