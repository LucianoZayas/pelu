import { test, expect } from '@playwright/test';
import path from 'path';
import postgres from 'postgres';

// IDs created during beforeAll — shared across the single test
let obraId: string;
let presupuestoBorradorId: string;

// ────────────────────────────────────────────────────────────
// Seed helper
// ────────────────────────────────────────────────────────────
async function seedObraConBorrador(timestamp: number) {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not set');

  const pg = postgres(url, { prepare: false, max: 1 });
  try {
    // 1. Resolve the admin user id (used for createdBy / updatedBy)
    const [adminUser] = await pg`
      SELECT id FROM usuario WHERE rol = 'admin' LIMIT 1
    `;
    if (!adminUser) throw new Error('No admin user found in DB');
    const userId: string = adminUser.id;

    // 2. Resolve a rubro id to attach to items
    const [rubroRow] = await pg`
      SELECT id FROM rubro WHERE id_padre IS NULL LIMIT 1
    `;
    if (!rubroRow) throw new Error('No rubro found in DB');
    const rubroId: string = rubroRow.id;

    // 3. Insert obra
    const codigo = `E2E-REIMP-${timestamp}`;
    const [obraRow] = await pg`
      INSERT INTO obra (
        codigo, nombre, cliente_nombre, moneda_base,
        cotizacion_usd_inicial, porcentaje_honorarios, estado,
        cliente_token, created_by, updated_by
      )
      VALUES (
        ${codigo},
        ${'Obra Reimport E2E'},
        ${'Cliente Test'},
        ${'USD'},
        ${'1200'},
        ${'16'},
        ${'activa'},
        ${`tok-reimp-${timestamp}`},
        ${userId},
        ${userId}
      )
      RETURNING id
    `;
    const newObraId: string = obraRow.id;

    // 4. Insert presupuesto borrador (importPendiente = false → manually created)
    const [presRow] = await pg`
      INSERT INTO presupuesto (
        obra_id, tipo, numero, estado, markup_default_porcentaje,
        cotizacion_usd, import_pendiente, created_by, updated_by
      )
      VALUES (
        ${newObraId},
        ${'original'},
        ${1},
        ${'borrador'},
        ${'30'},
        ${'1200'},
        ${false},
        ${userId},
        ${userId}
      )
      RETURNING id
    `;
    const newPresId: string = presRow.id;

    // 5. Insert 3 items
    for (let i = 0; i < 3; i++) {
      await pg`
        INSERT INTO item_presupuesto (
          presupuesto_id, rubro_id, orden, descripcion, unidad,
          cantidad, costo_unitario, costo_unitario_moneda,
          costo_unitario_base, markup_efectivo_porcentaje,
          precio_unitario_cliente
        )
        VALUES (
          ${newPresId},
          ${rubroId},
          ${i},
          ${`Item de prueba ${i + 1}`},
          ${'u'},
          ${'1'},
          ${'100'},
          ${'USD'},
          ${'100'},
          ${'30'},
          ${'130'}
        )
      `;
    }

    return { obraId: newObraId, presupuestoId: newPresId };
  } finally {
    await pg.end();
  }
}

// ────────────────────────────────────────────────────────────
// Cleanup helper
// ────────────────────────────────────────────────────────────
async function deleteE2EReimportObras() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.warn('E2E cleanup: DATABASE_URL not set, skipping');
    return;
  }
  const pg = postgres(url, { prepare: false, max: 1 });
  try {
    // Cascade deletes presupuestos + items via FK (items have ON DELETE CASCADE on presupuesto)
    // presupuesto FK to obra does NOT have cascade, so delete presupuestos first
    await pg`
      DELETE FROM presupuesto
      WHERE obra_id IN (SELECT id FROM obra WHERE codigo LIKE 'E2E-REIMP-%')
    `;
    await pg`DELETE FROM obra WHERE codigo LIKE 'E2E-REIMP-%'`;
  } catch (e) {
    console.warn('E2E REIMP cleanup failed:', e);
  } finally {
    await pg.end();
  }
}

// ────────────────────────────────────────────────────────────
// Hooks
// ────────────────────────────────────────────────────────────
test.beforeAll(async () => {
  const timestamp = Date.now();
  const seeded = await seedObraConBorrador(timestamp);
  obraId = seeded.obraId;
  presupuestoBorradorId = seeded.presupuestoId;
});

test.afterAll(async () => {
  await deleteE2EReimportObras();
});

// ────────────────────────────────────────────────────────────
// E2E test
// ────────────────────────────────────────────────────────────
test('re-import sobre obra existente con borrador: reemplaza y soft-delete', async ({ page }) => {
  // Login
  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? 'admin@macna.local';
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? 'ChangeMe!Local2026';
  await page.goto('/login');
  await page.fill('input[name=email]', adminEmail);
  await page.fill('input[name=password]', adminPassword);
  await page.click('button[type=submit]');
  await page.waitForURL(/\/obras/);

  // Navigate to the "import to existing obra" route
  await page.goto(`/obras/${obraId}/importar`);

  // Verify the "reemplazar_borrador" info banner is visible BEFORE upload
  await expect(
    page.getByText(/Esta obra ya tiene un presupuesto borrador/i),
  ).toBeVisible({ timeout: 10_000 });

  // Upload fixture
  const fixtureFile = path.join(
    process.cwd(),
    'scripts/import-sheets/__fixtures__/synthetic-small.xlsx',
  );
  await page.locator('input[type=file]').setInputFiles(fixtureFile);

  // Wait for PreviewSummary to appear
  await expect(page.getByText(/Resumen de la importaci/i)).toBeVisible({ timeout: 10_000 });

  // Click "Importar N items" → should open pre-flight dialog
  const importarBtn = page.getByRole('button', { name: /Importar \d+ items/i });
  await expect(importarBtn).toBeEnabled({ timeout: 5_000 });
  await importarBtn.click();

  // Pre-flight dialog "¿Reemplazar el borrador actual?" should appear
  await expect(
    page.getByText(/Reemplazar el borrador actual/i),
  ).toBeVisible({ timeout: 5_000 });

  // Confirm with "Reemplazar" button
  await page.getByRole('button', { name: /^Reemplazar$/i }).click();

  // Wait for redirect to editor for the new presupuesto
  await page.waitForURL(/\/obras\/[^/]+\/presupuestos\/[^/]+/, { timeout: 15_000 });

  // Verify import-pendiente banner appears in editor
  await expect(
    page.getByText(/Estás revisando una importación/i),
  ).toBeVisible({ timeout: 10_000 });

  // Extract the new presupuesto ID from the URL
  const finalUrl = page.url();
  const urlMatch = finalUrl.match(/\/presupuestos\/([^/?#]+)/);
  if (!urlMatch) throw new Error(`Unexpected URL after import: ${finalUrl}`);
  const newPresupuestoId = urlMatch[1];

  // Verify DB state:
  // 1. Previous borrador is soft-deleted (deletedAt IS NOT NULL)
  // 2. New presupuesto has reemplazadoPorImportId pointing to the old one
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.warn('DATABASE_URL not set — skipping DB assertions');
    return;
  }
  const pg = postgres(dbUrl, { prepare: false, max: 1 });
  try {
    // Old borrador should now be soft-deleted
    const [oldPres] = await pg`
      SELECT id, deleted_at, reemplazado_por_import_id
      FROM presupuesto
      WHERE id = ${presupuestoBorradorId}
    `;
    expect(oldPres, 'Old presupuesto should still exist in DB').toBeTruthy();
    expect(
      oldPres.deleted_at,
      'Old presupuesto should have deletedAt set (soft-deleted)',
    ).not.toBeNull();

    // New presupuesto should reference the old one via reemplazadoPorImportId
    const [newPres] = await pg`
      SELECT id, reemplazado_por_import_id
      FROM presupuesto
      WHERE id = ${newPresupuestoId}
    `;
    expect(newPres, 'New presupuesto should exist in DB').toBeTruthy();
    expect(
      newPres.reemplazado_por_import_id,
      'New presupuesto should reference old one via reemplazadoPorImportId',
    ).toBe(presupuestoBorradorId);
  } finally {
    await pg.end();
  }
});
