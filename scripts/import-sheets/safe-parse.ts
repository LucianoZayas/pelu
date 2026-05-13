export function safeParseNumber(v: unknown): number | null {
  if (v == null || v === '') return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v === 'object') {
    const o = v as { result?: unknown; richText?: { text: string }[] };
    if ('result' in o) return safeParseNumber(o.result);
    if ('richText' in o && Array.isArray(o.richText)) {
      return safeParseNumber(o.richText.map((t) => t.text).join(''));
    }
    return null;
  }
  if (typeof v === 'string') {
    if (v.startsWith('#')) return null;
    // Limpiar: quitar $, espacios, puntos de miles; convertir coma decimal a punto
    const cleaned = v.replace(/[$\s]/g, '').replace(/\.(?=\d{3}\b)/g, '').replace(',', '.');
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}
