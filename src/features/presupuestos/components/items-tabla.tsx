'use client';
import { useRef } from 'react';
import { useFieldArray, useFormContext } from 'react-hook-form';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Button } from '@/components/ui/button';
import { ItemRow } from './item-row';

type Props = {
  rubroIdx: number;
  rubrosOptions: { id: string; nombre: string }[];
  disabled: boolean;
};

export function ItemsTabla({ rubroIdx, rubrosOptions, disabled }: Props) {
  const { control } = useFormContext();
  const { fields, append, remove } = useFieldArray({ control, name: `rubros.${rubroIdx}.items` });
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualize = fields.length > 30;

  const rowVirtualizer = useVirtualizer({
    count: fields.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 40,
    overscan: 8,
  });

  const addEmpty = () =>
    append({
      descripcion: '', unidad: 'gl', cantidad: '1',
      costoUnitario: '0', costoUnitarioMoneda: 'USD',
      markupPorcentaje: null, notas: null,
      rubroId: rubrosOptions[rubroIdx]?.id, orden: fields.length,
    });

  return (
    <div>
      {virtualize ? (
        <div ref={parentRef} className="max-h-[600px] overflow-auto border rounded">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 sticky top-0">
              <tr>
                <th className="text-left p-1">Descripción</th>
                <th className="text-left p-1">Cant</th>
                <th className="text-left p-1">Un.</th>
                <th className="text-left p-1">Costo</th>
                <th className="text-left p-1">Mon</th>
                <th className="text-left p-1">Markup %</th>
                <th></th>
              </tr>
            </thead>
            <tbody style={{ height: rowVirtualizer.getTotalSize() }}>
              {rowVirtualizer.getVirtualItems().map((v) => (
                <ItemRow key={fields[v.index].id} rubroIdx={rubroIdx} itemIdx={v.index} onRemove={() => remove(v.index)} rubrosOptions={rubrosOptions} disabled={disabled} />
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <table className="w-full text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="text-left p-1">Descripción</th>
              <th className="text-left p-1">Cant</th>
              <th className="text-left p-1">Un.</th>
              <th className="text-left p-1">Costo</th>
              <th className="text-left p-1">Mon</th>
              <th className="text-left p-1">Markup %</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {fields.map((f, i) => (
              <ItemRow key={f.id} rubroIdx={rubroIdx} itemIdx={i} onRemove={() => remove(i)} rubrosOptions={rubrosOptions} disabled={disabled} />
            ))}
          </tbody>
        </table>
      )}
      <Button type="button" variant="outline" size="sm" className="mt-2" onClick={addEmpty} disabled={disabled}>+ Agregar item</Button>
    </div>
  );
}
