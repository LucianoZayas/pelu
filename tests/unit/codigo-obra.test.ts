import { siguienteCodigoObra } from '@/features/obras/codigo';

describe('siguienteCodigoObra', () => {
  it('arranca en 001 si no hay obras del año', () => {
    expect(siguienteCodigoObra(2026, [])).toBe('M-2026-001');
  });

  it('toma max + 1 entre los del mismo año', () => {
    expect(siguienteCodigoObra(2026, ['M-2026-001', 'M-2026-007', 'M-2025-099'])).toBe('M-2026-008');
  });

  it('ignora códigos no estándar', () => {
    expect(siguienteCodigoObra(2026, ['Manual-1', 'M-2026-002'])).toBe('M-2026-003');
  });

  it('rellena con ceros a 3 dígitos', () => {
    expect(siguienteCodigoObra(2026, ['M-2026-098'])).toBe('M-2026-099');
    expect(siguienteCodigoObra(2026, ['M-2026-099'])).toBe('M-2026-100');
  });
});
