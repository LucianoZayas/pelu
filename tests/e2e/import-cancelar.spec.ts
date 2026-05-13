import { test, expect } from '@playwright/test';
import path from 'path';
import postgres from 'postgres';

// ────────────────────────────────────────────────────────────
// Seed helper (mirrors import-reimport.spec.ts pattern)
// ────────────────────────────────────────────────────────────
async function seedObraConBorrador(timestamp: number) {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not set');

  const pg = postgres(url, { prepare: false, max: 1 });
  try {
    // 1. Resolve admin user id
    const [adminUser] = await pg`
      SELECT id FROM usuario WHERE rol = 'admin' LIMIT 1
    `;
    if (!adminUser) throw new Error('No admin user found in DB');
    const userId: string = adminUser.id;

    // 2. Resolve a rubro id
    const [rubroRow] = await pg`
      SELECT id FROM rubro WHERE id_padre IS NULL LIMIT 1
    `;
    if (!rubroRow) throw new Error('No rubro found in DB');
    const rubroId: string = rubroRow.id;

    // 3. Insert obra
    const codigo = `E2E-CANC-REIMP-${timestamp}`;
    const [obraRow] = await pg`
      INSERT INTO obra (
        codigo, nombre, cliente_nombre, moneda_base,
        cotizacion_usd_inicial, porcentaje_honorarios, estado,
        cliente_token, created_by, updated_by
      )
      VALUES (
        ${codigo},
        ${'Obra Cancelar Reimport E2E'},
        ${'Cliente Test Cancel'},
        ${'USD'},
        ${'1200'},
        ${'16'},
        ${'activa'},
        ${`tok-canc-reimp-${timestamp}`},
        ${userId},
        ${userId}
      )
      RETURNING id
    `;
    const newObraId: string = obraRow.id;

    // 4. Insert presupuesto borrador (import_pendiente = false → manually created)
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
          ${`Item cancelar ${i + 1}`},
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
async function deleteE2ECancObras() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.warn('E2E cleanup: DATABASE_URL not set, skipping');
    return;
  }
  const pg = postgres(url, { prepare: false, max: 1 });
  try {
    // Delete presupuestos first (FK to obra, no cascade), then obra
    await pg`
      DELETE FROM presupuesto
      WHERE obra_id IN (SELECT id FROM obra WHERE codigo LIKE 'E2E-CANC-%')
    `;
    await pg`DELETE FROM obra WHERE codigo LIKE 'E2E-CANC-%'`;
  } catch (e) {
    console.warn('E2E CANC cleanup failed:', e);
  } finally {
    await pg.end();
  }
}

// ────────────────────────────────────────────────────────────
// Shared login helper
// ────────────────────────────────────────────────────────────
async function loginAdmin(page: import('@playwright/test').Page) {
  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? 'admin@macna.local';
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? 'ChangeMe!Local2026';
  await page.goto('/login');
  await page.fill('input[name=email]', adminEmail);
  await page.fill('input[name=password]', adminPassword);
  await page.click('button[type=submit]');
  await page.waitForURL(/\/obras/);
}

// ────────────────────────────────────────────────────────────
// Tests
// ────────────────────────────────────────────────────────────
test.describe('Cancelar importación', () => {
  test.afterAll(async () => {
    await deleteE2ECancObras();
  });

  test('Test 1 — obra nueva: cancelar elimina la obra', async ({ page }) => {
    await loginAdmin(page);

    // Navigate to import
    await page.goto('/obras/importar');

    // Upload fixture
    const fixtureFile = path.join(
      process.cwd(),
      'scripts/import-sheets/__fixtures__/synthetic-small.xlsx',
    );
    await page.locator('input[type=file]').setInputFiles(fixtureFile);

    // Wait for preview
    await expect(page.getByText(/Resumen de la importaci/i)).toBeVisible({ timeout: 10_000 });

    // Fill required form fields
    const timestamp = Date.now();
    const codigoObra = `E2E-CANC-${timestamp}`;
    await page.locator('#codigoObra').fill(codigoObra);
    await page.locator('#nombreObra').fill('Obra Cancelar E2E');
    await page.locator('#clienteNombre').fill('Cliente Cancelar E2E');

    // Fill cotizacionUsd if needed
    const cotizacionInput = page.locator('#cotizacionUsd');
    const cotizacionValue = await cotizacionInput.inputValue();
    if (!cotizacionValue || cotizacionValue.trim() === '') {
      await cotizacionInput.fill('1200');
    }

    // Click "Importar N items"
    const importarBtn = page.getByRole('button', { name: /Importar \d+ items/i });
    await expect(importarBtn).toBeEnabled({ timeout: 5_000 });
    await importarBtn.click();

    // Wait for redirect to editor with import-pendiente banner
    await page.waitForURL(/\/obras\/[^/]+\/presupuestos\/[^/]+/, { timeout: 15_000 });
    await expect(page.getByText(/Estás revisando una importación/i)).toBeVisible({ timeout: 10_000 });

    // Click "Cancelar importación" trigger button
    await page.getByRole('button', { name: /Cancelar importación/i }).click();

    // Confirm in the destructive dialog
    await expect(page.getByRole('button', { name: /Sí, cancelar importación/i })).toBeVisible({ timeout: 5_000 });
    await page.getByRole('button', { name: /Sí, cancelar importación/i }).click();

    // Wait for redirect to /obras (obra nueva → obra deleted)
    await page.waitForURL(/^.*\/obras$/, { timeout: 15_000 });

    // Verify in DB: obra with that codigoObra does NOT exist (hard-deleted)
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) {
      console.warn('DATABASE_URL not set — skipping DB assertions');
      return;
    }
    const pg = postgres(dbUrl, { prepare: false, max: 1 });
    try {
      const rows = await pg`
        SELECT id FROM obra WHERE codigo = ${codigoObra}
      `;
      expect(rows.length, 'Obra should be hard-deleted after cancel').toBe(0);
    } finally {
      await pg.end();
    }
  });

  test('Test 2 — re-import sobre borrador: cancelar restaura presupuesto anterior', async ({ page }) => {
    // Seed obra with existing borrador presupuesto
    const timestamp = Date.now();
    const { obraId, presupuestoId: presupuestoBorradorId } = await seedObraConBorrador(timestamp);

    await loginAdmin(page);

    // Navigate to import for the seeded obra
    await page.goto(`/obras/${obraId}/importar`);

    // Verify "reemplazar_borrador" info banner is visible BEFORE upload
    await expect(
      page.getByText(/Esta obra ya tiene un presupuesto borrador/i),
    ).toBeVisible({ timeout: 10_000 });

    // Upload fixture
    const fixtureFile = path.join(
      process.cwd(),
      'scripts/import-sheets/__fixtures__/synthetic-small.xlsx',
    );
    await page.locator('input[type=file]').setInputFiles(fixtureFile);

    // Wait for preview
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
    const editorUrl = page.url();
    const urlMatch = editorUrl.match(/\/presupuestos\/([^/?#]+)/);
    if (!urlMatch) throw new Error(`Unexpected URL after import: ${editorUrl}`);
    const newPresupuestoId = urlMatch[1];

    // Click "Cancelar importación" trigger button
    await page.getByRole('button', { name: /Cancelar importación/i }).click();

    // Confirm in the destructive dialog
    await expect(page.getByRole('button', { name: /Sí, cancelar importación/i })).toBeVisible({ timeout: 5_000 });
    await page.getByRole('button', { name: /Sí, cancelar importación/i }).click();

    // Wait for redirect to /obras/{obraId} (obra still exists, only new presupuesto was discarded)
    await page.waitForURL(new RegExp(`/obras/${obraId}$`), { timeout: 15_000 });

    // Verify DB state
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) {
      console.warn('DATABASE_URL not set — skipping DB assertions');
      return;
    }
    const pg = postgres(dbUrl, { prepare: false, max: 1 });
    try {
      // 1. The new presupuesto (created by the import) should NOT exist anymore (hard-deleted)
      const [newPres] = await pg`
        SELECT id FROM presupuesto WHERE id = ${newPresupuestoId}
      `;
      expect(newPres, 'New presupuesto should be hard-deleted after cancel').toBeUndefined();

      // 2. The original borrador presupuesto IS restored (deletedAt IS NULL and reemplazadoPorImportId IS NULL)
      const [oldPres] = await pg`
        SELECT id, deleted_at, reemplazado_por_import_id
        FROM presupuesto
        WHERE id = ${presupuestoBorradorId}
      `;
      expect(oldPres, 'Original borrador presupuesto should still exist').toBeTruthy();
      expect(
        oldPres.deleted_at,
        'Original borrador presupuesto should have deletedAt = null (restored)',
      ).toBeNull();
      expect(
        oldPres.reemplazado_por_import_id,
        'Original borrador presupuesto should have reemplazadoPorImportId = null (restored)',
      ).toBeNull();

      // 3. The obra still exists
      const [obra] = await pg`
        SELECT id FROM obra WHERE id = ${obraId}
      `;
      expect(obra, 'Obra should still exist after cancel').toBeTruthy();
    } finally {
      await pg.end();
    }
  });
});
