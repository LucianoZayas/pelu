import {
  formatMoney,
  formatMoneyCompact,
  formatPercent,
  formatDelta,
  rangoDelPreset,
} from '@/lib/format';

describe('format helpers', () => {
  describe('formatMoney', () => {
    it('formatea ARS con prefijo $ y separadores AR', () => {
      expect(formatMoney(1234567.89, 'ARS')).toMatch(/^\$ /);
      expect(formatMoney(1234567.89, 'ARS')).toContain('1.234.567,89');
    });

    it('formatea USD con prefijo US$', () => {
      expect(formatMoney(1000, 'USD')).toMatch(/^US\$ /);
    });

    it('acepta strings', () => {
      expect(formatMoney('100.5', 'ARS')).toContain('100,50');
    });

    it('respeta minDecimals/maxDecimals', () => {
      expect(formatMoney(100, 'ARS', { minDecimals: 0, maxDecimals: 0 })).not.toContain(',00');
    });

    it('devuelve el string original si no es número', () => {
      expect(formatMoney('not-a-number', 'ARS')).toBe('not-a-number');
    });
  });

  describe('formatMoneyCompact', () => {
    it('usa notación compacta para valores grandes', () => {
      const r = formatMoneyCompact(1_500_000, 'ARS');
      // En es-AR, 1.500.000 → "1,5 M" (con espacio sin romper)
      expect(r).toMatch(/[KM]/i);
    });
  });

  describe('formatPercent', () => {
    it('multiplica por 100 y agrega %', () => {
      expect(formatPercent(0.25)).toBe('25.0%');
      expect(formatPercent(0.1234, 2)).toBe('12.34%');
    });
  });

  describe('formatDelta', () => {
    it('positivo: marca con flecha arriba y positive=true', () => {
      const d = formatDelta(0.5);
      expect(d.positive).toBe(true);
      expect(d.zero).toBe(false);
      expect(d.text).toContain('↑');
      expect(d.text).toContain('50');
    });

    it('negativo: marca con flecha abajo y positive=false', () => {
      const d = formatDelta(-0.3);
      expect(d.positive).toBe(false);
      expect(d.text).toContain('↓');
      expect(d.text).toContain('30');
    });

    it('cero: zero=true sin flecha', () => {
      const d = formatDelta(0);
      expect(d.zero).toBe(true);
    });
  });

  describe('rangoDelPreset', () => {
    const ahora = new Date(2026, 5, 15); // 15 junio 2026 (mes=5 zero-indexed)

    it('mes: primer y último día del mes actual', () => {
      const r = rangoDelPreset('mes', ahora);
      expect(r.desde).toBe('2026-06-01');
      expect(r.hasta).toBe('2026-06-30');
    });

    it('mes_pasado: rango del mes anterior', () => {
      const r = rangoDelPreset('mes_pasado', ahora);
      expect(r.desde).toBe('2026-05-01');
      expect(r.hasta).toBe('2026-05-31');
    });

    it('ultimos_30: rango de 30 días terminando hoy', () => {
      const r = rangoDelPreset('ultimos_30', ahora);
      expect(r.hasta).toBe('2026-06-15');
      // 15 jun - 30 días = 16 mayo
      expect(r.desde).toBe('2026-05-16');
    });

    it('anio: 1 enero - 31 diciembre del año actual', () => {
      const r = rangoDelPreset('anio', ahora);
      expect(r.desde).toBe('2026-01-01');
      expect(r.hasta).toBe('2026-12-31');
    });
  });
});
