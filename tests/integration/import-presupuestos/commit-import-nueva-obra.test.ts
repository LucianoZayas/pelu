/**
 * Integration tests for commitImportAction (Task 13)
 *
 * These tests exercise the full Server Action path:
 *   commitImportAction → requireRole (mocked) → commitImport → DB transaction → audit log
 *
 * Auth and next/cache are mocked at file level to avoid harness issues.
 */

import 'dotenv/config';
import { db, pg } from '@/db/client';
import { obra, presupuesto, itemPresupuesto, auditLog, usuario } from '@/db/schema';
import { eq, like, inArray } from 'drizzle-orm';
import type { ItemPreview } from '@/../scripts/import-sheets/tipos';

// ── Mocks ────────────────────────────────────────────────────────────────────

// Will be configured per-test in beforeAll after admin user is resolved
jest.mock('@/lib/auth/require', () => ({
  requireRole: jest.fn(),
}));

jest.mock('next/cache', () => ({ revalidatePath: jest.fn() }));

// ── Import action AFTER mocks are set up ─────────────────────────────────────

import { commitImportAction } from '@/features/import-presupuestos/actions';
import * as auth from '@/lib/auth/require';

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeCodigoObra() {
  return `IMPORTTEST-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

function makeItems(count = 2): ItemPreview[] {
  return Array.from({ length: count }, (_, i) => ({
    filaExcel: i + 1,
    rubro: 'Estructura',
    descripcion: `Ítem de prueba ${i + 1}`,
    ubicacion: null,
    cantidad: 1,
    unidad: 'gl' as const,
    costoUnitario: 1000,
    monedaCosto: 'ARS' as const,
    markupPorcentaje: 0.2,
    notas: '',
    warnings: [],
    estado: 'ok' as const,
    incluido: true,
  }));
}

function makeMetadatosObra(codigoObra: string) {
  return {
    codigoObra,
    nombreObra: `Obra Test ${codigoObra}`,
    clienteNombre: 'Cliente Test',
    monedaBase: 'ARS' as const,
    cotizacionUsd: '1500',
    markupDefaultPorcentaje: '30',
  };
}

const TEST_IMPORT_METADATA = {
  archivo: { nombre: 'test.xlsx', tamanioBytes: 1024, subidoEn: new Date().toISOString() },
  parseo: {
    hojaParseada: 'Hoja1',
    headerRow: 1,
    totalFilasExcel: 10,
    cotizacionDetectada: 1500,
    nombreObraDetectado: null,
    mapeoColumnas: {},
  },
  items: { totalImportados: 2, totalConWarning: 0, descartes: [] },
};

// ── State ─────────────────────────────────────────────────────────────────────

let adminUser: typeof usuario.$inferSelect;
const createdObraIds: string[] = [];

// ── Setup / Teardown ──────────────────────────────────────────────────────────

beforeAll(async () => {
  // Find the seeded admin user (admin@macna.local)
  const [found] = await db.select().from(usuario).where(eq(usuario.email, 'admin@macna.local')).limit(1);
  if (!found) throw new Error('Admin user not found — run seed first (admin@macna.local)');
  adminUser = found;

  // Configure the requireRole mock to return the real admin user shape
  (auth.requireRole as jest.Mock).mockResolvedValue({
    id: adminUser.id,
    email: adminUser.email,
    nombre: adminUser.nombre,
    rol: adminUser.rol,
  });
});

afterAll(async () => {
  // Clean up all obras/presupuestos created by this test run
  if (createdObraIds.length > 0) {
    // Delete items first (cascade handles items via presupuesto → item_presupuesto)
    const presupuestosObra = await db
      .select({ id: presupuesto.id })
      .from(presupuesto)
      .where(inArray(presupuesto.obraId, createdObraIds));
    const presupuestoIds = presupuestosObra.map((p) => p.id);

    if (presupuestoIds.length > 0) {
      // audit_log entries reference presupuesto.id — delete those first
      await db.delete(auditLog).where(inArray(auditLog.entidadId, presupuestoIds));
      // items deleted by cascade when deleting presupuesto, but let's be explicit
      await db.delete(itemPresupuesto).where(inArray(itemPresupuesto.presupuestoId, presupuestoIds));
      await db.delete(presupuesto).where(inArray(presupuesto.id, presupuestoIds));
    }
    // Also delete by IMPORTTEST- prefix to cover any leftover from previous failed runs
    const obrasFromPrefix = await db
      .select({ id: obra.id })
      .from(obra)
      .where(like(obra.codigo, 'IMPORTTEST-%'));
    const extraIds = obrasFromPrefix.map((o) => o.id).filter((id) => !createdObraIds.includes(id));
    if (extraIds.length > 0) {
      const presupuestosExtra = await db
        .select({ id: presupuesto.id })
        .from(presupuesto)
        .where(inArray(presupuesto.obraId, extraIds));
      const extraPIds = presupuestosExtra.map((p) => p.id);
      if (extraPIds.length > 0) {
        await db.delete(auditLog).where(inArray(auditLog.entidadId, extraPIds));
        await db.delete(itemPresupuesto).where(inArray(itemPresupuesto.presupuestoId, extraPIds));
        await db.delete(presupuesto).where(inArray(presupuesto.id, extraPIds));
      }
      await db.delete(obra).where(inArray(obra.id, extraIds));
    }
    await db.delete(obra).where(inArray(obra.id, createdObraIds));
  }
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('commitImportAction', () => {
  test('T1: happy path — creates obra + presupuesto with import_pendiente=true + N items', async () => {
    const codigoObra = makeCodigoObra();
    const items = makeItems(3);

    const result = await commitImportAction({
      items,
      metadatosObra: makeMetadatosObra(codigoObra),
      importMetadata: TEST_IMPORT_METADATA,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.error);

    createdObraIds.push(result.obraId);

    // Obra was created
    const [obraCreada] = await db.select().from(obra).where(eq(obra.id, result.obraId));
    expect(obraCreada).toBeDefined();
    expect(obraCreada.codigo).toBe(codigoObra);

    // Presupuesto was created with import_pendiente=true
    const [pCreado] = await db.select().from(presupuesto).where(eq(presupuesto.id, result.presupuestoId));
    expect(pCreado).toBeDefined();
    expect(pCreado.importPendiente).toBe(true);

    // N items created
    expect(result.itemsCreados).toBe(3);
    const dbItems = await db.select().from(itemPresupuesto).where(eq(itemPresupuesto.presupuestoId, result.presupuestoId));
    expect(dbItems).toHaveLength(3);

    // redirectTo is correct
    expect(result.redirectTo).toBe(`/obras/${result.obraId}/presupuestos/${result.presupuestoId}`);
  });

  test('T2: idempotency — calling with same codigoObra a second time fails (obra already exists)', async () => {
    const codigoObra = makeCodigoObra();
    const items = makeItems(1);

    // First call — should succeed
    const r1 = await commitImportAction({
      items,
      metadatosObra: makeMetadatosObra(codigoObra),
      importMetadata: TEST_IMPORT_METADATA,
    });
    expect(r1.ok).toBe(true);
    if (!r1.ok) throw new Error(r1.error);
    createdObraIds.push(r1.obraId);

    // Second call — same codigoObra, should fail (unique constraint on obra.codigo)
    const r2 = await commitImportAction({
      items,
      metadatosObra: makeMetadatosObra(codigoObra),
      importMetadata: TEST_IMPORT_METADATA,
    });
    expect(r2.ok).toBe(false);
    if (r2.ok) throw new Error('Expected second call to fail');
    expect(r2.error).toBeTruthy();
  });

  test('T3: items with 2 costs (material + MO split) generate 2 DB inserts', async () => {
    const codigoObra = makeCodigoObra();
    // Simulate C.2 split: two items with the same source row but different descriptions
    const splitItems: ItemPreview[] = [
      {
        filaExcel: 1,
        rubro: 'Estructura',
        descripcion: 'Hormigón — Material',
        ubicacion: null,
        cantidad: 1,
        unidad: 'gl',
        costoUnitario: 5000,
        monedaCosto: 'ARS',
        markupPorcentaje: 0.2,
        notas: '',
        warnings: [],
        estado: 'ok',
        incluido: true,
      },
      {
        filaExcel: 1,
        rubro: 'Estructura',
        descripcion: 'Hormigón — Mano de obra',
        ubicacion: null,
        cantidad: 1,
        unidad: 'gl',
        costoUnitario: 3000,
        monedaCosto: 'ARS',
        markupPorcentaje: 0.2,
        notas: '',
        warnings: [],
        estado: 'ok',
        incluido: true,
      },
    ];

    const result = await commitImportAction({
      items: splitItems,
      metadatosObra: makeMetadatosObra(codigoObra),
      importMetadata: TEST_IMPORT_METADATA,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.error);
    createdObraIds.push(result.obraId);

    // Exactly 2 items in DB (the C.2 split preserved)
    expect(result.itemsCreados).toBe(2);
    const dbItems = await db.select().from(itemPresupuesto).where(eq(itemPresupuesto.presupuestoId, result.presupuestoId));
    expect(dbItems).toHaveLength(2);

    const descriptions = dbItems.map((it) => it.descripcion).sort();
    expect(descriptions).toEqual(['Hormigón — Material', 'Hormigón — Mano de obra'].sort());
  });

  test('T4: audit log entry created with accion=crear and importMetadata in diff.after', async () => {
    const codigoObra = makeCodigoObra();
    const items = makeItems(2);

    const result = await commitImportAction({
      items,
      metadatosObra: makeMetadatosObra(codigoObra),
      importMetadata: TEST_IMPORT_METADATA,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.error);
    createdObraIds.push(result.obraId);

    // Audit log entry must exist
    const logs = await db
      .select()
      .from(auditLog)
      .where(eq(auditLog.entidadId, result.presupuestoId));

    expect(logs).toHaveLength(1);
    expect(logs[0].accion).toBe('crear');
    expect(logs[0].entidad).toBe('presupuesto');
    expect(logs[0].usuarioId).toBe(adminUser.id);

    // diff.after must contain importMetadata
    const diff = logs[0].diff as { after?: { importMetadata?: unknown } } | null;
    expect(diff).not.toBeNull();
    expect(diff?.after?.importMetadata).toEqual(TEST_IMPORT_METADATA);
  });

  test('T5: permissions — when requireRole throws, action returns { ok: false, error }', async () => {
    // Override the mock to simulate a role mismatch (403)
    (auth.requireRole as jest.Mock).mockRejectedValueOnce(
      new Response('Forbidden', { status: 403 }),
    );

    const codigoObra = makeCodigoObra();
    const items = makeItems(1);

    const result = await commitImportAction({
      items,
      metadatosObra: makeMetadatosObra(codigoObra),
      importMetadata: TEST_IMPORT_METADATA,
    });

    // The action must catch the thrown Response and return { ok: false }
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected action to fail on 403');
    expect(result.error).toBeTruthy();

    // No obra should have been created
    const obrasCreadas = await db.select().from(obra).where(eq(obra.codigo, codigoObra));
    expect(obrasCreadas).toHaveLength(0);
  });
});
