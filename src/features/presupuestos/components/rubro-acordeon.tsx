'use client';
import { useState } from 'react';
import { ItemsTabla } from './items-tabla';

type Props = {
  rubroIdx: number;
  rubroNombre: string;
  rubrosOptions: { id: string; nombre: string }[];
  disabled: boolean;
  importPendiente: boolean;
};

export function RubroAcordeon({ rubroIdx, rubroNombre, rubrosOptions, disabled, importPendiente }: Props) {
  const [open, setOpen] = useState(rubroIdx < 3);
  return (
    <section className="border rounded mb-2">
      <button type="button" className="w-full text-left p-3 font-semibold flex justify-between" onClick={() => setOpen(!open)}>
        <span>{rubroNombre}</span>
        <span>{open ? '−' : '+'}</span>
      </button>
      {open && (
        <div className="p-3 border-t">
          <ItemsTabla rubroIdx={rubroIdx} rubrosOptions={rubrosOptions} disabled={disabled} importPendiente={importPendiente} />
        </div>
      )}
    </section>
  );
}
