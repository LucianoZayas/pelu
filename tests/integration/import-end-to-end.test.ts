import 'dotenv/config';
import { resetDb } from './setup';
import { makeUsuario } from './factories';
import { db } from '@/db/client';
import { obra, presupuesto, itemPresupuesto, rubro } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { ejecutarImport } from '@/../scripts/import-sheets/ejecutor';
import { readFileSync } from 'fs';
import { resolve } from 'path';

describe('importador end-to-end', () => {
  beforeEach(async () => { await resetDb(); });

  it('importa fixture, crea obra + presupuesto + 3 items', async () => {
    const admin = await makeUsuario('admin');
    const csv = readFileSync(resolve(process.cwd(), 'fixtures/obra-ejemplo.csv'));

    const r = await ejecutarImport({
      buf: csv, codigoObra: 'M-2026-IMP', adminId: admin.id, dryRun: false,
      cotizacionUsd: '1200', markupDefault: '30',
    });
    expect(r.ok).toBe(true);

    const [o] = await db.select().from(obra).where(eq(obra.codigo, 'M-2026-IMP'));
    expect(o).toBeDefined();
    const [p] = await db.select().from(presupuesto).where(eq(presupuesto.obraId, o.id));
    expect(p.tipo).toBe('original');
    const items = await db.select().from(itemPresupuesto).where(eq(itemPresupuesto.presupuestoId, p.id));
    expect(items).toHaveLength(3);
  });

  it('--dry-run no escribe nada', async () => {
    const admin = await makeUsuario('admin');
    const csv = readFileSync(resolve(process.cwd(), 'fixtures/obra-ejemplo.csv'));
    await ejecutarImport({
      buf: csv, codigoObra: 'M-2026-DRY', adminId: admin.id, dryRun: true,
      cotizacionUsd: '1200', markupDefault: '30',
    });
    const all = await db.select().from(obra);
    expect(all.find((o) => o.codigo === 'M-2026-DRY')).toBeUndefined();
  });

  it('rechaza si codigo_obra ya existe', async () => {
    const admin = await makeUsuario('admin');
    const csv = readFileSync(resolve(process.cwd(), 'fixtures/obra-ejemplo.csv'));
    await ejecutarImport({ buf: csv, codigoObra: 'M-2026-DUP', adminId: admin.id, dryRun: false, cotizacionUsd: '1200', markupDefault: '30' });
    const r = await ejecutarImport({ buf: csv, codigoObra: 'M-2026-DUP', adminId: admin.id, dryRun: false, cotizacionUsd: '1200', markupDefault: '30' });
    expect(r.ok).toBe(false);
  });

  it('crea rubro nuevo con creado_por_importador=true si no existe', async () => {
    const admin = await makeUsuario('admin');
    const csv = readFileSync(resolve(process.cwd(), 'fixtures/obra-ejemplo.csv'));
    await ejecutarImport({ buf: csv, codigoObra: 'M-2026-RUB', adminId: admin.id, dryRun: false, cotizacionUsd: '1200', markupDefault: '30' });
    const rubros = await db.select().from(rubro).where(eq(rubro.creadoPorImportador, true));
    expect(rubros.length).toBeGreaterThan(0);
  });
});
