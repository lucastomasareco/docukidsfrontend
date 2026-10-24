import { test, expect } from '@playwright/test';

test.describe('Docukids E2E Web Verification (Issue #12)', () => {
  test('Debería cargar la página principal de la app correctamente', async ({ page }) => {
    // Navega a la URL de la app web
    await page.goto('/');

    // Verifica que el título o elemento principal esté presente
    await expect(page).toHaveTitle(/Docukids/i);
  });
});