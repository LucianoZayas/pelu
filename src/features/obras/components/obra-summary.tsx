export function ObraSummary({ obra }: { obra: { codigo: string; nombre: string; clienteNombre: string; estado: string; monedaBase: string } }) {
  return (
    <header className="flex items-center justify-between mb-6">
      <div>
        <h1 className="text-2xl font-semibold">{obra.nombre}</h1>
        <p className="text-sm text-muted-foreground font-mono">{obra.codigo} · {obra.clienteNombre} · {obra.monedaBase}</p>
      </div>
      <span className="text-xs px-2 py-1 rounded bg-slate-100">{obra.estado}</span>
    </header>
  );
}
