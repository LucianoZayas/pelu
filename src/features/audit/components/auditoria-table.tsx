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

export function AuditoriaTable({ rows }: { rows: Row[] }) {
  const [open, setOpen] = useState<string | null>(null);
  return (
    <table className="w-full text-sm border">
      <thead className="bg-slate-50">
        <tr>
          <th className="text-left p-2">Cuándo</th>
          <th className="text-left p-2">Quién</th>
          <th className="text-left p-2">Entidad</th>
          <th className="text-left p-2">Acción</th>
          <th className="text-left p-2">Descripción</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <Fragment key={r.log.id}>
            <tr className="border-t cursor-pointer hover:bg-slate-50" onClick={() => setOpen(open === r.log.id ? null : r.log.id)}>
              <td className="p-2 font-mono text-xs">{new Date(r.log.timestamp).toLocaleString('es-AR')}</td>
              <td className="p-2">{r.usuarioNombre ?? r.usuarioEmail ?? '?'}</td>
              <td className="p-2">{r.log.entidad}</td>
              <td className="p-2">{r.log.accion}</td>
              <td className="p-2">{r.log.descripcionHumana ?? <em className="text-muted-foreground">sin descripción</em>}</td>
            </tr>
            {open === r.log.id && r.log.diff != null && (
              <tr className="bg-slate-50">
                <td colSpan={5} className="p-3"><pre className="text-xs whitespace-pre-wrap">{JSON.stringify(r.log.diff, null, 2)}</pre></td>
              </tr>
            )}
          </Fragment>
        ))}
      </tbody>
    </table>
  );
}
