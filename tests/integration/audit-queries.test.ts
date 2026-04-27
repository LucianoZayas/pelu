import { resetDb } from './setup';
import { makeUsuario } from './factories';
import { logAudit } from '@/features/audit/log';
import { buscarLogs } from '@/features/audit/queries';
import { randomUUID } from 'crypto';

describe('audit queries', () => {
  beforeEach(async () => { await resetDb(); });

  it('filtra por entidad y rango', async () => {
    const u = await makeUsuario('admin');
    const id1 = randomUUID(), id2 = randomUUID();
    await logAudit({ entidad: 'obra', entidadId: id1, accion: 'crear', usuarioId: u.id });
    await logAudit({ entidad: 'presupuesto', entidadId: id2, accion: 'firmar', usuarioId: u.id });

    const todos = await buscarLogs({});
    expect(todos.length).toBe(2);

    const soloObras = await buscarLogs({ entidad: 'obra' });
    expect(soloObras).toHaveLength(1);

    const porUsuario = await buscarLogs({ usuarioId: u.id });
    expect(porUsuario).toHaveLength(2);
  });

  it('paginación: limit + offset', async () => {
    const u = await makeUsuario('admin');
    for (let i = 0; i < 5; i++) {
      await logAudit({ entidad: 'obra', entidadId: randomUUID(), accion: 'crear', usuarioId: u.id });
    }
    const page1 = await buscarLogs({ limit: 2, offset: 0 });
    const page2 = await buscarLogs({ limit: 2, offset: 2 });
    expect(page1).toHaveLength(2);
    expect(page2).toHaveLength(2);
    expect(page1[0].log.id).not.toBe(page2[0].log.id);
  });
});
