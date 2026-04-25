import { resetDb } from './setup';
import { makeUsuario } from './factories';
import { db } from '@/db/client';
import { obra, auditLog } from '@/db/schema';
import { eq } from 'drizzle-orm';
import * as actions from '@/features/obras/actions';

jest.mock('@/lib/auth/require', () => ({
  __esModule: true,
  getSessionUser: jest.fn(),
  requireSession: jest.fn(),
  requireRole: jest.fn(),
}));
import * as auth from '@/lib/auth/require';

describe('obras/actions', () => {
  beforeEach(async () => { await resetDb(); jest.clearAllMocks(); });

  it('Admin crea obra y se loguea audit', async () => {
    const admin = await makeUsuario('admin');
    (auth.requireRole as jest.Mock).mockResolvedValue(admin);

    const result = await actions.crearObra({
      nombre: 'Casa Test',
      clienteNombre: 'Juan Pérez',
      monedaBase: 'USD',
      porcentajeHonorarios: '16',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const [creada] = await db.select().from(obra).where(eq(obra.id, result.id));
    expect(creada.nombre).toBe('Casa Test');
    expect(creada.codigo).toMatch(/^M-\d{4}-\d{3}$/);
    expect(creada.clienteToken).toHaveLength(43);

    const logs = await db.select().from(auditLog).where(eq(auditLog.entidadId, result.id));
    expect(logs).toHaveLength(1);
    expect(logs[0].accion).toBe('crear');
  });

  it('Operador no puede crear obra (403)', async () => {
    (auth.requireRole as jest.Mock).mockRejectedValue(new Response('Forbidden', { status: 403 }));
    await expect(actions.crearObra({
      nombre: 'X', clienteNombre: 'Y', monedaBase: 'USD', porcentajeHonorarios: '16',
    })).rejects.toBeInstanceOf(Response);
  });

  it('soft delete deja la obra fuera de listarObras', async () => {
    const admin = await makeUsuario('admin');
    (auth.requireRole as jest.Mock).mockResolvedValue(admin);

    const r = await actions.crearObra({
      nombre: 'Borrar', clienteNombre: 'C', monedaBase: 'USD', porcentajeHonorarios: '16',
    });
    if (!r.ok) throw new Error('crearObra failed');
    await actions.eliminarObra(r.id);

    const { listarObras } = await import('@/features/obras/queries');
    const lista = await listarObras();
    expect(lista.find((o) => o.id === r.id)).toBeUndefined();
  });
});
