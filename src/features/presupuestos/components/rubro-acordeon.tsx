'use client';
import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { ItemsTabla } from './items-tabla';

type Props = {
  rubroIdx: number;
  rubroNombre: string;
  rubrosOptions: { id: string; nombre: string }[];
  disabled: boolean;
  importPendiente: boolean;
};

export function RubroAcordeon({ rubroIdx, rubroNombre, rubrosOptions, disabled, importPendiente }: Props) {
  // Cuando viene de un import recién hecho, expandir TODOS los rubros por defecto
  // para que el usuario revise cada item sin riesgo de saltearse uno por no
  // haber expandido el acordeón. En presupuestos normales, abrir los primeros 3.
  const [open, setOpen] = useState(importPendiente || rubroIdx < 3);
  return (
    <section className="mb-2 overflow-hidden rounded-lg border bg-card">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-secondary/60"
        onClick={() => setOpen(!open)}
      >
        <span className="text-[13.5px] font-semibold text-foreground">{rubroNombre}</span>
        {open ? (
          <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform" />
        ) : (
          <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform" />
        )}
      </button>
      {open && (
        <div className="border-t bg-background px-4 pb-4 pt-3">
          <ItemsTabla rubroIdx={rubroIdx} rubrosOptions={rubrosOptions} disabled={disabled} importPendiente={importPendiente} />
        </div>
      )}
    </section>
  );
}
