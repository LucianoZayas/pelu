'use client';
import { Fragment, useState } from 'react';

type Row = {
  log: {
    id: string;
    entidad: string;
    entidadId: string;
    accion: string;
    diff: unknown;
    descripcionHumana: string | null;
    timestamp: Date;
  };
  usuarioNombre: string | null;
  usuarioEmail: string | null;
};

function accionBadgeClass(accion: string) {
  switch (accion) {
    case 'crear': return 'bg-emerald-50 border-emerald-200 text-emerald-800';
    case 'firmar': return 'bg-emerald-50 border-emerald-200 text-emerald-800';
    case 'editar': return 'bg-sky-50 border-sky-200 text-sky-800';
    case 'cancelar': return 'bg-rose-50 border-rose-200 text-rose-800';
    case 'eliminar': return 'bg-rose-50 border-rose-200 text-rose-800';
    default: return 'bg-slate-100 border-slate-200 text-slate-700';
  }
}

export function AuditoriaTable({ rows }: { rows: Row[] }) {
  const [open, setOpen] = useState<string | null>(null);
  return (
    <div className="rounded-xl border bg-card shadow-[0_1px_2px_rgba(16,24,40,0.04),0_1px_3px_rgba(16,24,40,0.08)] overflow-hidden">
      <table className="w-full text-[13px]">
        <thead>
          <tr className="border-b bg-secondary/60">
            <th className="text-left px-4 py-2.5 text-[10.5px] font-semibold uppercase tracking-[0.1em] text-muted-foreground/70">
              Cuándo
            </th>
            <th className="text-left px-4 py-2.5 text-[10.5px] font-semibold uppercase tracking-[0.1em] text-muted-foreground/70">
              Quién
            </th>
            <th className="text-left px-4 py-2.5 text-[10.5px] font-semibold uppercase tracking-[0.1em] text-muted-foreground/70">
              Entidad
            </th>
            <th className="text-left px-4 py-2.5 text-[10.5px] font-semibold uppercase tracking-[0.1em] text-muted-foreground/70">
              Acción
            </th>
            <th className="text-left px-4 py-2.5 text-[10.5px] font-semibold uppercase tracking-[0.1em] text-muted-foreground/70">
              Descripción
            </th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.length === 0 && (
            <tr>
              <td colSpan={5} className="px-4 py-8 text-center text-[13px] text-muted-foreground">
                No hay registros para los filtros seleccionados.
              </td>
            </tr>
          )}
          {rows.map((r) => (
            <Fragment key={r.log.id}>
              <tr
                className="cursor-pointer hover:bg-secondary/40 transition-colors"
                onClick={() => setOpen(open === r.log.id ? null : r.log.id)}
              >
                <td className="px-4 py-2.5 font-mono text-[11.5px] text-muted-foreground whitespace-nowrap">
                  {new Date(r.log.timestamp).toLocaleString('es-AR')}
                </td>
                <td className="px-4 py-2.5 text-foreground">
                  {r.usuarioNombre ?? r.usuarioEmail ?? (
                    <span className="text-muted-foreground">?</span>
                  )}
                </td>
                <td className="px-4 py-2.5 font-mono text-[12px] text-muted-foreground capitalize">
                  {r.log.entidad}
                </td>
                <td className="px-4 py-2.5">
                  <span
                    className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium capitalize ${accionBadgeClass(r.log.accion)}`}
                  >
                    {r.log.accion.replace('_', ' ')}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-muted-foreground max-w-xs truncate">
                  {r.log.descripcionHumana ?? (
                    <em className="text-muted-foreground/60">sin descripción</em>
                  )}
                </td>
              </tr>
              {open === r.log.id && r.log.diff != null && (
                <tr className="bg-secondary/30">
                  <td colSpan={5} className="px-4 py-3">
                    <pre className="text-[11.5px] font-mono text-muted-foreground whitespace-pre-wrap break-all">
                      {JSON.stringify(r.log.diff, null, 2)}
                    </pre>
                  </td>
                </tr>
              )}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}
