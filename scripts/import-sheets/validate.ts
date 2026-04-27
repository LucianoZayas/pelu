import type { FilaCsv } from './tipos';

const UNIDADES = ['m2', 'm3', 'hs', 'gl', 'u', 'ml', 'kg'] as const;
const MONEDAS = ['USD', 'ARS'] as const;

export type ValidacionResult = { ok: true } | { ok: false; error: string };

export function validarFila(f: FilaCsv, indice: number): ValidacionResult {
  if (!f.rubro?.trim()) return { ok: false, error: `[fila ${indice + 1}] rubro vacío` };
  if (!f.descripcion?.trim()) return { ok: false, error: `[fila ${indice + 1}] descripción vacía` };
  if (!UNIDADES.includes(f.unidad as (typeof UNIDADES)[number])) {
    return { ok: false, error: `[fila ${indice + 1}] unidad inválida: ${f.unidad}` };
  }
  if (!/^\d+(\.\d+)?$/.test(f.cantidad)) {
    return { ok: false, error: `[fila ${indice + 1}] cantidad no numérica: ${f.cantidad}` };
  }
  if (!/^\d+(\.\d+)?$/.test(f.costo_unitario)) {
    return { ok: false, error: `[fila ${indice + 1}] costo_unitario no numérico: ${f.costo_unitario}` };
  }
  if (!MONEDAS.includes(f.moneda_costo as (typeof MONEDAS)[number])) {
    return { ok: false, error: `[fila ${indice + 1}] moneda_costo inválida: ${f.moneda_costo}` };
  }
  if (f.markup && !/^-?\d+(\.\d+)?$/.test(f.markup)) {
    return { ok: false, error: `[fila ${indice + 1}] markup no numérico: ${f.markup}` };
  }
  return { ok: true };
}
