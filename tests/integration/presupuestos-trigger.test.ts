import { resetDb } from './setup';
import { makeUsuario, makeRubro, makeObra } from './factories';
import { db } from '@/db/client';
import { itemPresupuesto, presupuesto } from '@/db/schema';
import { eq } from 'drizzle-orm';
import * as actions from '@/features/presupuestos/actions';

jest.mock('@/lib/auth/require', () => ({
  __esModule: true,
  getSessionUser: jest.fn(),
  requireSession: jest.fn(),
  requireRole: jest.fn(),
}));
import * as auth from '@/lib/auth/require';

describe('trigger escrito en piedra', () => {
  beforeEach(async () => { await resetDb(); jest.clearAllMocks(); });

  it('UPDATE directo a item de presupuesto firmado es rechazado por Postgres', async () => {
    const admin = await makeUsuario('admin');
    (auth.requireRole as jest.Mock).mockResolvedValue(admin);
    const o = await makeObra(admin.id);
    const ru = await makeRubro();

    const c = await actions.crearPresupuesto({ obraId: o.id, tipo: 'original', descripcion: null, markupDefaultPorcentaje: '30', cotizacionUsd: '1200' });
    if (!c.ok) throw new Error();
    await actions.guardarPresupuesto({
      presupuestoId: c.id, version: 1, descripcion: null,
      markupDefaultPorcentaje: '30', cotizacionUsd: '1200',
      items: [{
        rubroId: ru.id, orden: 0, descripcion: 'X', unidad: 'm2',
        cantidad: '1', costoUnitario: '100', costoUnitarioMoneda: 'USD',
        markupPorcentaje: null, notas: null,
      }],
    });
    await actions.firmarPresupuesto(c.id, 2);

    const [it] = await db.select().from(itemPresupuesto).where(eq(itemPresupuesto.presupuestoId, c.id));

    await expect(
      db.update(itemPresupuesto).set({ cantidad: '999' }).where(eq(itemPresupuesto.id, it.id)),
    ).rejects.toThrow(/firmado/);
  });

  it('UPDATE a presupuesto firmado (mismo estado) es rechazado por Postgres', async () => {
    const admin = await makeUsuario('admin');
    (auth.requireRole as jest.Mock).mockResolvedValue(admin);
    const o = await makeObra(admin.id);
    const c = await actions.crearPresupuesto({ obraId: o.id, tipo: 'original', descripcion: null, markupDefaultPorcentaje: '30', cotizacionUsd: '1200' });
    if (!c.ok) throw new Error();
    await actions.firmarPresupuesto(c.id, 1);

    await expect(
      db.update(presupuesto).set({ descripcion: 'cambio prohibido' }).where(eq(presupuesto.id, c.id)),
    ).rejects.toThrow(/firmado/);
  });
});
