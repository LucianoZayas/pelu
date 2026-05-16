import { cuentaInputSchema } from '@/features/cuentas/schema';
import { conceptoMovimientoInputSchema } from '@/features/conceptos-movimiento/schema';
import { parteInputSchema } from '@/features/partes/schema';
import { proveedorInputSchema } from '@/features/proveedores/schema';

describe('schemas de configuración del flujo de caja', () => {
  describe('cuentaInputSchema', () => {
    it('acepta cuenta válida mínima', () => {
      const r = cuentaInputSchema.safeParse({
        nombre: 'Caja USD',
        moneda: 'USD',
        tipo: 'caja',
      });
      expect(r.success).toBe(true);
    });

    it('rechaza nombre vacío', () => {
      expect(cuentaInputSchema.safeParse({ nombre: '', moneda: 'USD', tipo: 'caja' }).success).toBe(false);
    });

    it('rechaza tipo desconocido', () => {
      expect(cuentaInputSchema.safeParse({ nombre: 'x', moneda: 'USD', tipo: 'tarjeta' }).success).toBe(false);
    });

    it('acepta notas opcional como null', () => {
      const r = cuentaInputSchema.safeParse({
        nombre: 'Banco', moneda: 'ARS', tipo: 'banco', notas: null,
      });
      expect(r.success).toBe(true);
    });
  });

  describe('conceptoMovimientoInputSchema', () => {
    const valid = {
      codigo: 'HO',
      nombre: 'Honorarios de Obra',
      tipo: 'ingreso' as const,
    };

    it('acepta concepto válido', () => {
      expect(conceptoMovimientoInputSchema.safeParse(valid).success).toBe(true);
    });

    it('rechaza código en minúsculas', () => {
      const r = conceptoMovimientoInputSchema.safeParse({ ...valid, codigo: 'ho' });
      expect(r.success).toBe(false);
      if (!r.success) expect(r.error.issues[0].message).toMatch(/MAY/i);
    });

    it('rechaza código con espacios', () => {
      expect(conceptoMovimientoInputSchema.safeParse({ ...valid, codigo: 'CO BRO' }).success).toBe(false);
    });

    it('acepta código con underscores y números', () => {
      expect(conceptoMovimientoInputSchema.safeParse({ ...valid, codigo: 'MO_BENEFICIO_2' }).success).toBe(true);
    });
  });

  describe('parteInputSchema', () => {
    it('acepta tipos manuales (empresa, socio, empleado, externo)', () => {
      for (const tipo of ['empresa', 'socio', 'empleado', 'externo'] as const) {
        const r = parteInputSchema.safeParse({ tipo, nombre: 'X' });
        expect(r.success).toBe(true);
      }
    });

    it('rechaza tipos auto-generados (obra, proveedor, cliente)', () => {
      expect(parteInputSchema.safeParse({ tipo: 'obra', nombre: 'X' }).success).toBe(false);
      expect(parteInputSchema.safeParse({ tipo: 'proveedor', nombre: 'X' }).success).toBe(false);
      expect(parteInputSchema.safeParse({ tipo: 'cliente', nombre: 'X' }).success).toBe(false);
    });

    it('acepta datos opcionales como objeto', () => {
      const r = parteInputSchema.safeParse({
        tipo: 'externo',
        nombre: 'Financiera',
        datos: { cuit: '20-12345678-9', contacto: 'tel: 11-1234-5678' },
      });
      expect(r.success).toBe(true);
    });
  });

  describe('proveedorInputSchema', () => {
    it('acepta proveedor mínimo', () => {
      const r = proveedorInputSchema.safeParse({ nombre: 'Plomero Pérez' });
      expect(r.success).toBe(true);
    });

    it('default esContratista=false', () => {
      const r = proveedorInputSchema.safeParse({ nombre: 'Hierros' });
      if (r.success) expect(r.data.esContratista).toBe(false);
    });

    it('acepta esContratista=true', () => {
      const r = proveedorInputSchema.safeParse({ nombre: 'Plomero', esContratista: true });
      if (r.success) expect(r.data.esContratista).toBe(true);
    });
  });
});
