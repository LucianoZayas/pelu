import {
  crearCertificacionInputSchema,
  actualizarAvanceInputSchema,
  emitirInputSchema,
  cobrarInputSchema,
  anularCertInputSchema,
} from '@/features/certificaciones/schema';

const UUID_1 = '123e4567-e89b-42d3-a456-426614174000';
const UUID_2 = '223e4567-e89b-42d3-a456-426614174000';
const UUID_3 = '323e4567-e89b-42d3-a456-426614174000';

describe('certificaciones schema (zod)', () => {
  describe('crearCertificacionInputSchema', () => {
    it('acepta payload mínimo', () => {
      expect(crearCertificacionInputSchema.safeParse({ presupuestoId: UUID_1 }).success).toBe(true);
    });

    it('acepta con descripción', () => {
      const r = crearCertificacionInputSchema.safeParse({
        presupuestoId: UUID_1,
        descripcion: 'Mayo 2026',
      });
      expect(r.success).toBe(true);
    });

    it('rechaza uuid inválido', () => {
      expect(crearCertificacionInputSchema.safeParse({ presupuestoId: 'no-uuid' }).success).toBe(false);
    });

    it('rechaza descripcion muy larga (>500)', () => {
      const r = crearCertificacionInputSchema.safeParse({
        presupuestoId: UUID_1,
        descripcion: 'x'.repeat(501),
      });
      expect(r.success).toBe(false);
    });
  });

  describe('actualizarAvanceInputSchema', () => {
    const valid = {
      certificacionId: UUID_1,
      avances: [
        { itemPresupuestoId: UUID_2, porcentajeAcumulado: 50 },
        { itemPresupuestoId: UUID_3, porcentajeAcumulado: 30 },
      ],
    };

    it('acepta payload válido', () => {
      expect(actualizarAvanceInputSchema.safeParse(valid).success).toBe(true);
    });

    it('rechaza avances vacío', () => {
      expect(actualizarAvanceInputSchema.safeParse({ ...valid, avances: [] }).success).toBe(false);
    });

    it('rechaza porcentaje fuera de [0,100]', () => {
      expect(actualizarAvanceInputSchema.safeParse({
        ...valid,
        avances: [{ itemPresupuestoId: UUID_2, porcentajeAcumulado: 150 }],
      }).success).toBe(false);
      expect(actualizarAvanceInputSchema.safeParse({
        ...valid,
        avances: [{ itemPresupuestoId: UUID_2, porcentajeAcumulado: -5 }],
      }).success).toBe(false);
    });

    it('coerce strings numéricos en porcentaje', () => {
      const r = actualizarAvanceInputSchema.safeParse({
        ...valid,
        avances: [{ itemPresupuestoId: UUID_2, porcentajeAcumulado: '75.5' }],
      });
      expect(r.success).toBe(true);
      if (r.success) expect(r.data.avances[0].porcentajeAcumulado).toBe(75.5);
    });
  });

  describe('cobrarInputSchema', () => {
    const valid = {
      certificacionId: UUID_1,
      cuentaId: UUID_2,
      fecha: '2026-05-15',
    };

    it('acepta payload mínimo', () => {
      expect(cobrarInputSchema.safeParse(valid).success).toBe(true);
    });

    it('rechaza fecha mal formada', () => {
      expect(cobrarInputSchema.safeParse({ ...valid, fecha: '15/05/2026' }).success).toBe(false);
    });

    it('acepta conceptos custom opcionales', () => {
      const r = cobrarInputSchema.safeParse({
        ...valid,
        conceptoNetoId: UUID_3,
        conceptoHonorariosId: UUID_3,
      });
      expect(r.success).toBe(true);
    });
  });

  describe('anularCertInputSchema', () => {
    it('requiere motivo de al menos 3 caracteres', () => {
      expect(anularCertInputSchema.safeParse({ certificacionId: UUID_1, motivo: 'OK' }).success).toBe(false);
      expect(anularCertInputSchema.safeParse({ certificacionId: UUID_1, motivo: 'val' }).success).toBe(true);
    });

    it('limita motivo a 300 chars', () => {
      expect(anularCertInputSchema.safeParse({
        certificacionId: UUID_1,
        motivo: 'x'.repeat(301),
      }).success).toBe(false);
    });
  });

  describe('emitirInputSchema', () => {
    it('requiere uuid', () => {
      expect(emitirInputSchema.safeParse({ certificacionId: UUID_1 }).success).toBe(true);
      expect(emitirInputSchema.safeParse({ certificacionId: 'no' }).success).toBe(false);
    });
  });
});
