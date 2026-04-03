import { test, expect } from '@playwright/test';

test.describe('Responsividade', () => {
  test('login deve ser responsivo', async ({ page }) => {
    await page.goto('/login');

    // Desktop
    await page.setViewportSize({ width: 1280, height: 720 });
    await expect(page.getByRole('button', { name: /entrar/i })).toBeVisible();

    // Tablet
    await page.setViewportSize({ width: 768, height: 1024 });
    await expect(page.getByRole('button', { name: /entrar/i })).toBeVisible();

    // Mobile
    await page.setViewportSize({ width: 375, height: 667 });
    await expect(page.getByRole('button', { name: /entrar/i })).toBeVisible();
  });

  test('formulário de login deve ser usável em mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/login');

    const emailInput = page.getByPlaceholder(/email/i);
    const senhaInput = page.getByPlaceholder(/senha/i);
    const entrarBtn = page.getByRole('button', { name: /entrar/i });

    // Todos os elementos devem estar visíveis e interagíveis
    await expect(emailInput).toBeVisible();
    await expect(senhaInput).toBeVisible();
    await expect(entrarBtn).toBeVisible();

    // Verifica que não há overflow horizontal
    const body = page.locator('body');
    const bodyWidth = await body.evaluate((el) => el.scrollWidth);
    const viewportWidth = 375;
    expect(bodyWidth).toBeLessThanOrEqual(viewportWidth + 1); // +1 para tolerância
  });
});
