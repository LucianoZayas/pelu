import {
  movimientoInputSchema,
  movimientoSimpleInputSchema,
  movimientoTransferenciaInputSchema,
  anularInputSchema,
} from '@/features/movimientos/schema';

describe('movimientos schema (zod)', () => {
  describe('movimientoSimpleInputSchema (entrada/salida)', () => {
    const valid = {
      tipoOperacion: 'entrada' as const,
      conceptoId: '123e4567-e89b-42d3-a456-426614174000',
      fecha: '2026-05-15',
      cuentaId: '223e4567-e89b-42d3-a456-426614174000',
      monto: 1000,
      moneda: 'ARS' as const,
    };

    it('acepta payload válido mínimo', () => {
      const r = movimientoSimpleInputSchema.safeParse(valid);
      expect(r.success).toBe(true);
    });

    it('rechaza monto cero o negativo', () => {
      expect(movimientoSimpleInputSchema.safeParse({ ...valid, monto: 0 }).success).toBe(false);
      expect(movimientoSimpleInputSchema.safeParse({ ...valid, monto: -5 }).success).toBe(false);
    });

    it('rechaza fecha mal formada', () => {
      expect(movimientoSimpleInputSchema.safeParse({ ...valid, fecha: '15/05/2026' }).success).toBe(false);
      expect(movimientoSimpleInputSchema.safeParse({ ...valid, fecha: 'hoy' }).success).toBe(false);
    });

    it('rechaza conceptoId que no es uuid', () => {
      expect(movimientoSimpleInputSchema.safeParse({ ...valid, conceptoId: 'no-uuid' }).success).toBe(false);
    });

    it('rechaza moneda inválida', () => {
      expect(movimientoSimpleInputSchema.safeParse({ ...valid, moneda: 'EUR' }).success).toBe(false);
    });

    it('acepta campos opcionales nullables', () => {
      const r = movimientoSimpleInputSchema.safeParse({
        ...valid,
        cotizacionUsd: 850,
        parteOrigenId: '323e4567-e89b-42d3-a456-426614174000',
        descripcion: null,
        numeroComprobante: 'FC-0001',
        esNoRecuperable: true,
      });
      expect(r.success).toBe(true);
    });

    it('coerce strings numéricos a number en monto', () => {
      const r = movimientoSimpleInputSchema.safeParse({ ...valid, monto: '500.50' });
      expect(r.success).toBe(true);
      if (r.success) expect(r.data.monto).toBe(500.5);
    });
  });

  describe('movimientoTransferenciaInputSchema', () => {
    const valid = {
      tipoOperacion: 'transferencia' as const,
      conceptoId: '123e4567-e89b-42d3-a456-426614174000',
      fecha: '2026-05-15',
      cuentaId: '223e4567-e89b-42d3-a456-426614174000',
      cuentaDestinoId: '423e4567-e89b-42d3-a456-426614174000',
      monto: 100,
      moneda: 'USD' as const,
    };

    it('acepta transferencia básica', () => {
      expect(movimientoTransferenciaInputSchema.safeParse(valid).success).toBe(true);
    });

    it('rechaza si cuentaOrigen === cuentaDestino', () => {
      const r = movimientoTransferenciaInputSchema.safeParse({
        ...valid,
        cuentaDestinoId: valid.cuentaId,
      });
      expect(r.success).toBe(false);
      if (!r.success) {
        // Confirma que el path apunta a cuentaDestinoId
        expect(r.error.issues.some((i) => i.path.includes('cuentaDestinoId'))).toBe(true);
      }
    });

    it('acepta transferencia FX con montoDestino + cotizacion', () => {
      const r = movimientoTransferenciaInputSchema.safeParse({
        ...valid,
        montoDestino: 85000,
        cotizacionUsd: 850,
      });
      expect(r.success).toBe(true);
    });
  });

  describe('movimientoInputSchema (discriminated union)', () => {
    it('discrimina por tipoOperacion', () => {
      const entrada = movimientoInputSchema.safeParse({
        tipoOperacion: 'entrada',
        conceptoId: '123e4567-e89b-42d3-a456-426614174000',
        fecha: '2026-05-15',
        cuentaId: '223e4567-e89b-42d3-a456-426614174000',
        monto: 100,
        moneda: 'ARS',
      });
      expect(entrada.success).toBe(true);

      const transfer = movimientoInputSchema.safeParse({
        tipoOperacion: 'transferencia',
        conceptoId: '123e4567-e89b-42d3-a456-426614174000',
        fecha: '2026-05-15',
        cuentaId: '223e4567-e89b-42d3-a456-426614174000',
        cuentaDestinoId: '423e4567-e89b-42d3-a456-426614174000',
        monto: 100,
        moneda: 'USD',
      });
      expect(transfer.success).toBe(true);
    });

    it('rechaza tipoOperacion desconocido', () => {
      const r = movimientoInputSchema.safeParse({
        tipoOperacion: 'otro',
        conceptoId: '123e4567-e89b-42d3-a456-426614174000',
        fecha: '2026-05-15',
        cuentaId: '223e4567-e89b-42d3-a456-426614174000',
        monto: 100,
        moneda: 'ARS',
      });
      expect(r.success).toBe(false);
    });
  });

  describe('anularInputSchema', () => {
    it('requiere motivo de al menos 3 caracteres', () => {
      expect(anularInputSchema.safeParse({ motivo: 'OK' }).success).toBe(false);
      expect(anularInputSchema.safeParse({ motivo: 'mal' }).success).toBe(true);
    });

    it('limita motivo a 300 caracteres', () => {
      const largo = 'x'.repeat(301);
      expect(anularInputSchema.safeParse({ motivo: largo }).success).toBe(false);
    });
  });
});
