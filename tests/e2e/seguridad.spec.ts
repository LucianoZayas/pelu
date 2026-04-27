import { test, expect } from '@playwright/test';

test('operador no puede acceder al editor de presupuesto', async ({ page }) => {
  await page.goto('/login');
  await page.fill('input[name=email]', process.env.SEED_OPERADOR_EMAIL!);
  await page.fill('input[name=password]', process.env.SEED_OPERADOR_PASSWORD!);
  await page.click('button[type=submit]');
  await expect(page).toHaveURL(/\/obras/);

  // Acceder directo a una URL de editor → 403/404.
  const r = await page.goto(
    '/obras/00000000-0000-0000-0000-000000000000/presupuestos/00000000-0000-0000-0000-000000000000',
  );
  expect([403, 404]).toContain(r?.status() ?? 0);
});
