const RE = /^M-(\d{4})-(\d{3,})$/;

export function siguienteCodigoObra(anio: number, existentes: string[]): string {
  const max = existentes.reduce((acc, codigo) => {
    const m = RE.exec(codigo);
    if (!m) return acc;
    if (Number(m[1]) !== anio) return acc;
    return Math.max(acc, Number(m[2]));
  }, 0);
  return `M-${anio}-${String(max + 1).padStart(3, '0')}`;
}
