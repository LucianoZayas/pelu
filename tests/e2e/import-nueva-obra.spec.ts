import { test, expect } from '@playwright/test';
import path from 'path';
import postgres from 'postgres';

// Cleanup helper — runs against Supabase directly (not via Next.js app)
async function deleteE2EObras() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.warn('E2E cleanup: DATABASE_URL not set, skipping');
    return;
  }
  const pg = postgres(url, { prepare: false, max: 1 });
  try {
    await pg`DELETE FROM obra WHERE codigo LIKE 'E2E-%'`;
  } catch (e) {
    console.warn('E2E cleanup failed:', e);
  } finally {
    await pg.end();
  }
}

test.afterAll(async () => {
  await deleteE2EObras();
});

test('admin sube Excel, revisa preview, confirma import', async ({ page }) => {
  // Login — use env vars with fallback to seeded dev credentials
  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? 'admin@macna.local';
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? 'ChangeMe!Local2026';
  await page.goto('/login');
  await page.fill('input[name=email]', adminEmail);
  await page.fill('input[name=password]', adminPassword);
  await page.click('button[type=submit]');
  await page.waitForURL(/\/obras/);

  // Navigate to import via the "Nueva obra desde Excel" link
  await page.click('text=Nueva obra desde Excel');
  await page.waitForURL('/obras/importar');

  // Upload fixture — the input is sr-only but still interactable via setInputFiles
  const fixtureFile = path.join(process.cwd(), 'scripts/import-sheets/__fixtures__/synthetic-small.xlsx');
  await page.locator('input[type=file]').setInputFiles(fixtureFile);

  // Wait for preview summary to appear ("Resumen de la importación")
  await expect(page.getByText(/Resumen de la importaci/i)).toBeVisible({ timeout: 10_000 });

  // Fill required form fields — FormMetadatosObra uses id attributes, not name
  await page.locator('#codigoObra').fill(`E2E-${Date.now()}`);
  await page.locator('#nombreObra').fill('Obra E2E happy path');
  await page.locator('#clienteNombre').fill('Cliente E2E');

  // cotizacionUsd is required — if not already filled from Excel detection, fill it
  const cotizacionInput = page.locator('#cotizacionUsd');
  const cotizacionValue = await cotizacionInput.inputValue();
  if (!cotizacionValue || cotizacionValue.trim() === '') {
    await cotizacionInput.fill('1200');
  }

  // Click "Importar N items" — wait for it to be enabled
  const importarBtn = page.getByRole('button', { name: /Importar \d+ items/i });
  await expect(importarBtn).toBeEnabled({ timeout: 5_000 });
  await importarBtn.click();

  // Redirect to editor with import-pendiente banner
  await page.waitForURL(/\/obras\/[^/]+\/presupuestos\/[^/]+/, { timeout: 15_000 });
  await expect(page.getByText(/Estás revisando una importación/i)).toBeVisible();

  // Confirm import — trigger button opens dialog
  await page.getByRole('button', { name: /Confirmar importación/i }).click();
  // The dialog inner confirm button
  await page.getByRole('button', { name: /^Confirmar$/i }).click();

  // Banner should disappear after confirmation
  await expect(page.getByText(/Estás revisando una importación/i)).not.toBeVisible({ timeout: 10_000 });
});
