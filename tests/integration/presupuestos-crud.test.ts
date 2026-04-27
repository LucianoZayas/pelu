import { resetDb } from './setup';
import { makeUsuario, makeRubro, makeObra } from './factories';
import { db } from '@/db/client';
import { presupuesto, itemPresupuesto } from '@/db/schema';
import { eq } from 'drizzle-orm';
import * as actions from '@/features/presupuestos/actions';

jest.mock('@/lib/auth/require', () => ({
  __esModule: true,
  getSessionUser: jest.fn(),
  requireSession: jest.fn(),
  requireRole: jest.fn(),
}));
import * as auth from '@/lib/auth/require';

describe('presupuestos CRUD', () => {
  beforeEach(async () => { await resetDb(); jest.clearAllMocks(); });

  it('crea presupuesto original con numero=1, version=1', async () => {
    const admin = await makeUsuario('admin');
    (auth.requireRole as jest.Mock).mockResolvedValue(admin);
    const o = await makeObra(admin.id);

    const r = await actions.crearPresupuesto({
      obraId: o.id, tipo: 'original',
      descripcion: 'Original', markupDefaultPorcentaje: '30', cotizacionUsd: '1200',
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const [p] = await db.select().from(presupuesto).where(eq(presupuesto.id, r.id));
    expect(p.numero).toBe(1);
    expect(p.tipo).toBe('original');
    expect(p.estado).toBe('borrador');
    expect(p.version).toBe(1);
  });

  it('un segundo presupuesto en la misma obra es adicional con numero=2', async () => {
    const admin = await makeUsuario('admin');
    (auth.requireRole as jest.Mock).mockResolvedValue(admin);
    const o = await makeObra(admin.id);
    await actions.crearPresupuesto({ obraId: o.id, tipo: 'original', descripcion: null, markupDefaultPorcentaje: '30', cotizacionUsd: '1200' });
    const r2 = await actions.crearPresupuesto({ obraId: o.id, tipo: 'adicional', descripcion: 'Ad 1', markupDefaultPorcentaje: '30', cotizacionUsd: '1300' });
    if (!r2.ok) throw new Error();
    const [p2] = await db.select().from(presupuesto).where(eq(presupuesto.id, r2.id));
    expect(p2.numero).toBe(2);
    expect(p2.tipo).toBe('adicional');
  });

  it('guarda items con snapshots calculados y persistidos', async () => {
    const admin = await makeUsuario('admin');
    (auth.requireRole as jest.Mock).mockResolvedValue(admin);
    const o = await makeObra(admin.id);
    const ru = await makeRubro();
    const r = await actions.crearPresupuesto({ obraId: o.id, tipo: 'original', descripcion: null, markupDefaultPorcentaje: '30', cotizacionUsd: '1200' });
    if (!r.ok) throw new Error();

    const guard = await actions.guardarPresupuesto({
      presupuestoId: r.id, version: 1,
      descripcion: null, markupDefaultPorcentaje: '30', cotizacionUsd: '1200',
      items: [{
        rubroId: ru.id, orden: 0, descripcion: 'Demolición muro',
        unidad: 'm2', cantidad: '20', costoUnitario: '100',
        costoUnitarioMoneda: 'USD', markupPorcentaje: null, notas: null,
      }],
    });
    expect(guard.ok).toBe(true);

    const items = await db.select().from(itemPresupuesto).where(eq(itemPresupuesto.presupuestoId, r.id));
    expect(items).toHaveLength(1);
    expect(items[0].costoUnitarioBase).toBe('100.0000');
    expect(items[0].markupEfectivoPorcentaje).toBe('30.00');
    expect(items[0].precioUnitarioCliente).toBe('130.0000');
  });
});
