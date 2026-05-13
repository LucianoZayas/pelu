/**
 * Integration tests for cancelarImportAction (Task 14)
 *
 * Test cases:
 *   1. Caso obra nueva: hard DELETE presupuesto + obra, audit log, returns { ok: true, redirectTo: '/obras' }
 *   2. Caso re-import sobre borrador: hard DELETE nuevo, restore anterior, audit log,
 *      returns { ok: true, redirectTo: '/obras/<obraId>' }
 *   3. Caso import_pendiente=false: returns { ok: false, error: 'No es una importación pendiente' }
 *   4. Not found: invalid presupuestoId → returns { ok: false, error: 'Presupuesto no encontrado' }
 */

import 'dotenv/config';
import { db } from '@/db/client';
import { obra, presupuesto, itemPresupuesto, auditLog, usuario } from '@/db/schema';
import { eq, inArray, like } from 'drizzle-orm';
import { randomUUID } from 'crypto';

// ── Mocks ────────────────────────────────────────────────────────────────────

jest.mock('@/lib/auth/require', () => ({
  requireRole: jest.fn(),
}));

jest.mock('next/cache', () => ({ revalidatePath: jest.fn() }));

// ── Import action AFTER mocks are set up ─────────────────────────────────────

import { cancelarImportAction } from '@/features/import-presupuestos/actions';
import * as auth from '@/lib/auth/require';

// ── State ─────────────────────────────────────────────────────────────────────

let adminUser: typeof usuario.$inferSelect;
const createdObraIds: string[] = [];

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeCodigoObra() {
  return `IMPORTTEST-CANCEL-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

/** Seeds a new obra + one presupuesto with import_pendiente=true (obra nueva scenario) */
async function seedObraNueva(): Promise<{ obraId: string; presupuestoId: string }> {
  const codigoObra = makeCodigoObra();
  const [obraCreada] = await db
    .insert(obra)
    .values({
      codigo: codigoObra,
      nombre: `Obra Cancelar Test ${codigoObra}`,
      clienteNombre: 'Cliente Test Cancelar',
      monedaBase: 'ARS',
      estado: 'borrador',
      clienteToken: randomUUID(),
      createdBy: adminUser.id,
      updatedBy: adminUser.id,
    })
    .returning({ id: obra.id });

  createdObraIds.push(obraCreada.id);

  const [pCreado] = await db
    .insert(presupuesto)
    .values({
      obraId: obraCreada.id,
      tipo: 'original',
      numero: 1,
      estado: 'borrador',
      cotizacionUsd: '1500',
      importPendiente: true,
      createdBy: adminUser.id,
      updatedBy: adminUser.id,
    })
    .returning({ id: presupuesto.id });

  return { obraId: obraCreada.id, presupuestoId: pCreado.id };
}

/**
 * Seeds the re-import scenario:
 * - obra with one borrador presupuesto (anterior, soft-deleted)
 * - a second presupuesto with import_pendiente=true and reemplazadoPorImportId pointing to anterior
 *
 * Returns { obraId, anteriorId, nuevoId }
 */
async function seedReimport(): Promise<{
  obraId: string;
  anteriorId: string;
  nuevoId: string;
}> {
  const codigoObra = makeCodigoObra();
  const [obraCreada] = await db
    .insert(obra)
    .values({
      codigo: codigoObra,
      nombre: `Obra Reimport Test ${codigoObra}`,
      clienteNombre: 'Cliente Test Reimport',
      monedaBase: 'ARS',
      estado: 'borrador',
      clienteToken: randomUUID(),
      createdBy: adminUser.id,
      updatedBy: adminUser.id,
    })
    .returning({ id: obra.id });

  createdObraIds.push(obraCreada.id);

  // anterior presupuesto — will be soft-deleted below
  const [anterior] = await db
    .insert(presupuesto)
    .values({
      obraId: obraCreada.id,
      tipo: 'original',
      numero: 1,
      estado: 'borrador',
      cotizacionUsd: '1500',
      importPendiente: false,
      createdBy: adminUser.id,
      updatedBy: adminUser.id,
    })
    .returning({ id: presupuesto.id });

  // nuevo presupuesto — import_pendiente=true, reemplazadoPorImportId points to anterior.
  // Convention (from commitImport in ejecutor.ts): the NEW presupuesto's
  // reemplazadoPorImportId references the OLD one it replaced. The OLD presupuesto
  // is soft-deleted (deletedAt set) but its own reemplazadoPorImportId stays null.
  const [nuevo] = await db
    .insert(presupuesto)
    .values({
      obraId: obraCreada.id,
      tipo: 'original',
      numero: 2,
      estado: 'borrador',
      cotizacionUsd: '1500',
      importPendiente: true,
      reemplazadoPorImportId: anterior.id,
      createdBy: adminUser.id,
      updatedBy: adminUser.id,
    })
    .returning({ id: presupuesto.id });

  // Soft-delete anterior (no reemplazadoPorImportId on it; the new one points back).
  await db
    .update(presupuesto)
    .set({ deletedAt: new Date() })
    .where(eq(presupuesto.id, anterior.id));

  return { obraId: obraCreada.id, anteriorId: anterior.id, nuevoId: nuevo.id };
}

// ── Setup / Teardown ──────────────────────────────────────────────────────────

beforeAll(async () => {
  const [found] = await db
    .select()
    .from(usuario)
    .where(eq(usuario.email, 'admin@macna.local'))
    .limit(1);
  if (!found) throw new Error('Admin user not found — run seed first (admin@macna.local)');
  adminUser = found;

  (auth.requireRole as jest.Mock).mockResolvedValue({
    id: adminUser.id,
    email: adminUser.email,
    nombre: adminUser.nombre,
    rol: adminUser.rol,
  });
});

afterAll(async () => {
  // Clean up by prefix to cover any leftover from previous failed runs
  const obrasFromPrefix = await db
    .select({ id: obra.id })
    .from(obra)
    .where(like(obra.codigo, 'IMPORTTEST-CANCEL-%'));
  const prefixObraIds = obrasFromPrefix.map((o) => o.id);
  const allObraIds = [...new Set([...createdObraIds, ...prefixObraIds])];

  if (allObraIds.length > 0) {
    const presupuestosFromObras = await db
      .select({ id: presupuesto.id })
      .from(presupuesto)
      .where(inArray(presupuesto.obraId, allObraIds));
    const allPIds = presupuestosFromObras.map((p) => p.id);

    if (allPIds.length > 0) {
      await db.delete(auditLog).where(inArray(auditLog.entidadId, allPIds));
      await db.delete(itemPresupuesto).where(inArray(itemPresupuesto.presupuestoId, allPIds));
      // clear reemplazadoPorImportId references before delete to avoid constraint issues
      await db
        .update(presupuesto)
        .set({ reemplazadoPorImportId: null, deletedAt: null })
        .where(inArray(presupuesto.id, allPIds));
      await db.delete(presupuesto).where(inArray(presupuesto.id, allPIds));
    }

    await db.delete(obra).where(inArray(obra.id, allObraIds));
  }
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('cancelarImportAction', () => {
  test('T1: caso obra nueva — hard DELETE presupuesto + obra, returns { ok: true, redirectTo: "/obras" }', async () => {
    const { obraId, presupuestoId } = await seedObraNueva();

    const logsBefore = await db
      .select()
      .from(auditLog)
      .where(eq(auditLog.entidadId, presupuestoId));

    const result = await cancelarImportAction({ presupuestoId });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.error);
    expect(result.redirectTo).toBe('/obras');

    // Presupuesto hard-deleted
    const pRows = await db.select().from(presupuesto).where(eq(presupuesto.id, presupuestoId));
    expect(pRows).toHaveLength(0);

    // Obra hard-deleted
    const obraRows = await db.select().from(obra).where(eq(obra.id, obraId));
    expect(obraRows).toHaveLength(0);

    // Audit log entry created
    const logsAfter = await db
      .select()
      .from(auditLog)
      .where(eq(auditLog.entidadId, presupuestoId));
    expect(logsAfter.length).toBe(logsBefore.length + 1);

    const newLog = logsAfter[logsAfter.length - 1];
    expect(newLog.accion).toBe('cancelar');
    expect(newLog.entidad).toBe('presupuesto');
    expect(newLog.usuarioId).toBe(adminUser.id);
    expect(newLog.descripcionHumana).toContain('Import cancelado');

    // Remove from cleanup list since they're already deleted
    const obraIdx = createdObraIds.indexOf(obraId);
    if (obraIdx !== -1) createdObraIds.splice(obraIdx, 1);
  });

  test('T2: caso re-import — hard DELETE nuevo, restore anterior, returns { ok: true, redirectTo: "/obras/<obraId>" }', async () => {
    const { obraId, anteriorId, nuevoId } = await seedReimport();

    const logsBefore = await db
      .select()
      .from(auditLog)
      .where(eq(auditLog.entidadId, nuevoId));

    const result = await cancelarImportAction({ presupuestoId: nuevoId });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.error);
    expect(result.redirectTo).toBe(`/obras/${obraId}`);

    // Nuevo presupuesto hard-deleted
    const nuevoRows = await db.select().from(presupuesto).where(eq(presupuesto.id, nuevoId));
    expect(nuevoRows).toHaveLength(0);

    // Anterior presupuesto restored: deletedAt=null, reemplazadoPorImportId=null
    const [anteriorRestored] = await db
      .select()
      .from(presupuesto)
      .where(eq(presupuesto.id, anteriorId));
    expect(anteriorRestored).toBeDefined();
    expect(anteriorRestored.deletedAt).toBeNull();
    expect(anteriorRestored.reemplazadoPorImportId).toBeNull();

    // Obra still exists
    const obraRows = await db.select().from(obra).where(eq(obra.id, obraId));
    expect(obraRows).toHaveLength(1);

    // Audit log entry created
    const logsAfter = await db
      .select()
      .from(auditLog)
      .where(eq(auditLog.entidadId, nuevoId));
    expect(logsAfter.length).toBe(logsBefore.length + 1);

    const newLog = logsAfter[logsAfter.length - 1];
    expect(newLog.accion).toBe('cancelar');
    expect(newLog.entidad).toBe('presupuesto');
    expect(newLog.usuarioId).toBe(adminUser.id);
    expect(newLog.descripcionHumana).toContain('Import cancelado');
  });

  test('T3: import_pendiente=false — returns { ok: false, error: "No es una importación pendiente" }', async () => {
    // Seed a presupuesto with import_pendiente=false
    const codigoObra = makeCodigoObra();
    const [obraCreada] = await db
      .insert(obra)
      .values({
        codigo: codigoObra,
        nombre: `Obra NoPendiente Test`,
        clienteNombre: 'Cliente Test',
        monedaBase: 'ARS',
        estado: 'borrador',
        clienteToken: randomUUID(),
        createdBy: adminUser.id,
        updatedBy: adminUser.id,
      })
      .returning({ id: obra.id });

    createdObraIds.push(obraCreada.id);

    const [pCreado] = await db
      .insert(presupuesto)
      .values({
        obraId: obraCreada.id,
        tipo: 'original',
        numero: 1,
        estado: 'borrador',
        cotizacionUsd: '1500',
        importPendiente: false,
        createdBy: adminUser.id,
        updatedBy: adminUser.id,
      })
      .returning({ id: presupuesto.id });

    const result = await cancelarImportAction({ presupuestoId: pCreado.id });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected action to fail');
    expect(result.error).toBe('No es una importación pendiente');
  });

  test('T4: not found — invalid presupuestoId returns { ok: false, error: "Presupuesto no encontrado" }', async () => {
    const fakeId = randomUUID();

    const result = await cancelarImportAction({ presupuestoId: fakeId });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected action to fail on not-found');
    expect(result.error).toBe('Presupuesto no encontrado');
  });
});
