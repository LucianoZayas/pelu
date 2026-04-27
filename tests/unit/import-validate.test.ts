import { validarFila } from '@/../scripts/import-sheets/validate';

describe('import.validarFila', () => {
  it('válida cuando todo está en regla', () => {
    expect(validarFila({
      rubro: 'X', descripcion: 'Y', unidad: 'm2',
      cantidad: '1', costo_unitario: '100', moneda_costo: 'USD',
      markup: '', notas: '',
    }, 0)).toEqual({ ok: true });
  });

  it('rechaza unidad inválida', () => {
    const r = validarFila({
      rubro: 'X', descripcion: 'Y', unidad: 'XX',
      cantidad: '1', costo_unitario: '100', moneda_costo: 'USD', markup: '', notas: '',
    }, 0);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/unidad/);
  });

  it('rechaza cantidad no numérica', () => {
    const r = validarFila({
      rubro: 'X', descripcion: 'Y', unidad: 'm2',
      cantidad: 'abc', costo_unitario: '100', moneda_costo: 'USD', markup: '', notas: '',
    }, 0);
    expect(r.ok).toBe(false);
  });

  it('rechaza moneda no soportada', () => {
    const r = validarFila({
      rubro: 'X', descripcion: 'Y', unidad: 'm2',
      cantidad: '1', costo_unitario: '100', moneda_costo: 'EUR', markup: '', notas: '',
    }, 0);
    expect(r.ok).toBe(false);
  });

  it('rechaza descripción vacía', () => {
    const r = validarFila({
      rubro: 'X', descripcion: '', unidad: 'm2',
      cantidad: '1', costo_unitario: '100', moneda_costo: 'USD', markup: '', notas: '',
    }, 0);
    expect(r.ok).toBe(false);
  });
});
