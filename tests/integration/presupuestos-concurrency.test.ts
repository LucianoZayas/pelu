import { resetDb } from './setup';
import { makeUsuario, makeRubro, makeObra } from './factories';
import * as actions from '@/features/presupuestos/actions';

jest.mock('@/lib/auth/require', () => ({
  __esModule: true,
  getSessionUser: jest.fn(),
  requireSession: jest.fn(),
  requireRole: jest.fn(),
}));
import * as auth from '@/lib/auth/require';

describe('concurrencia optimista', () => {
  beforeEach(async () => { await resetDb(); jest.clearAllMocks(); });

  it('dos saves con la misma version: el segundo recibe STALE_VERSION', async () => {
    const admin = await makeUsuario('admin');
    (auth.requireRole as jest.Mock).mockResolvedValue(admin);
    const o = await makeObra(admin.id);
    const ru = await makeRubro();
    const c = await actions.crearPresupuesto({ obraId: o.id, tipo: 'original', descripcion: null, markupDefaultPorcentaje: '30', cotizacionUsd: '1200' });
    if (!c.ok) throw new Error();

    const payload = {
      presupuestoId: c.id, version: 1, descripcion: null,
      markupDefaultPorcentaje: '30', cotizacionUsd: '1200',
      items: [{
        rubroId: ru.id, orden: 0, descripcion: 'X', unidad: 'm2' as const,
        cantidad: '1', costoUnitario: '100', costoUnitarioMoneda: 'USD' as const,
        markupPorcentaje: null, notas: null,
      }],
    };

    const r1 = await actions.guardarPresupuesto(payload);
    expect(r1.ok).toBe(true);

    const r2 = await actions.guardarPresupuesto(payload); // misma version=1
    expect(r2.ok).toBe(false);
    if (r2.ok) return;
    expect(r2.code).toBe('STALE_VERSION');
  });
});
