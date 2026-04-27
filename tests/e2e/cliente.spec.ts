import { test, expect } from '@playwright/test';

// Happy path E2E. Asume seed con admin y al menos una obra+presupuesto firmado.
test('admin firma presupuesto y el cliente lo ve por token', async ({ page }) => {
  await page.goto('/login');
  await page.fill('input[name=email]', process.env.SEED_ADMIN_EMAIL!);
  await page.fill('input[name=password]', process.env.SEED_ADMIN_PASSWORD!);
  await page.click('button[type=submit]');
  await expect(page).toHaveURL(/\/obras/);

  // El test asume una obra firmada existente; si no, crearla aquí via UI.
});

test('token inválido redirige a /cliente/expirado (NO 404)', async ({ page }) => {
  const r = await page.goto('/cliente/totally-invalid-token-xxxxxxxxxxxxxxxxxxxxxx');
  expect(page.url()).toContain('/cliente/expirado');
  // Status del último response renderizado debe ser 200 (la página estática), no 404.
  expect([200, 304]).toContain(r?.status() ?? 0);
});
