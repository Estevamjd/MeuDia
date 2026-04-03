import { test, expect } from '@playwright/test';

/**
 * Testes que exigem autenticação.
 * Usa credenciais de teste para login antes de cada teste.
 */
test.describe('Dashboard (autenticado)', () => {
  const TEST_EMAIL = process.env.E2E_TEST_EMAIL || 'teste@meudia.app';
  const TEST_PASSWORD = process.env.E2E_TEST_PASSWORD || 'teste123';

  async function login(page: import('@playwright/test').Page) {
    await page.goto('/login');
    await page.getByPlaceholder(/email/i).fill(TEST_EMAIL);
    await page.getByPlaceholder(/senha/i).fill(TEST_PASSWORD);
    await page.getByRole('button', { name: /entrar/i }).click();
    await page.waitForURL(/\/inicio/, { timeout: 15000 });
  }

  test('deve fazer login e exibir o dashboard', async ({ page }) => {
    await login(page);
    await expect(page).toHaveURL(/\/inicio/);
    // Deve exibir o nome do usuário ou saudação
    await expect(
      page.getByText(/olá|bem-vindo|início|dashboard/i).first()
    ).toBeVisible({ timeout: 5000 });
  });

  test('deve navegar para Treinos', async ({ page }) => {
    await login(page);
    await page.getByRole('link', { name: /treino/i }).first().click();
    await page.waitForURL(/\/treinos/);
    await expect(page).toHaveURL(/\/treinos/);
  });

  test('deve navegar para Hábitos', async ({ page }) => {
    await login(page);
    await page.getByRole('link', { name: /hábit/i }).first().click();
    await page.waitForURL(/\/habitos/);
    await expect(page).toHaveURL(/\/habitos/);
  });

  test('deve navegar para Dieta', async ({ page }) => {
    await login(page);
    await page.getByRole('link', { name: /dieta|nutrição/i }).first().click();
    await page.waitForURL(/\/dieta/);
    await expect(page).toHaveURL(/\/dieta/);
  });

  test('deve navegar para Finanças', async ({ page }) => {
    await login(page);
    await page.getByRole('link', { name: /finanç/i }).first().click();
    await page.waitForURL(/\/financas/);
    await expect(page).toHaveURL(/\/financas/);
  });

  test('deve navegar para Agenda', async ({ page }) => {
    await login(page);
    await page.getByRole('link', { name: /agenda/i }).first().click();
    await page.waitForURL(/\/agenda/);
    await expect(page).toHaveURL(/\/agenda/);
  });

  test('sidebar deve fechar ao navegar no mobile', async ({ page }) => {
    // Apenas no projeto mobile-chrome
    test.skip(
      !test.info().project.name.includes('mobile'),
      'Teste apenas para mobile'
    );

    await login(page);

    // Abre menu mobile
    const menuButton = page.getByRole('button', { name: /menu/i });
    if (await menuButton.isVisible()) {
      await menuButton.click();
      // Clica em Treinos
      await page.getByRole('link', { name: /treino/i }).first().click();
      await page.waitForURL(/\/treinos/);
      // Sidebar overlay deve ter sumido
      const overlay = page.locator('.fixed.inset-0.bg-black\\/60');
      await expect(overlay).not.toBeVisible({ timeout: 3000 });
    }
  });

  test('deve fazer logout', async ({ page }) => {
    await login(page);

    // Procura botão de sair na sidebar ou menu
    const sairButton = page.getByRole('button', { name: /sair|logout/i }).first();
    if (await sairButton.isVisible()) {
      await sairButton.click();
      await page.waitForURL(/\/login/, { timeout: 10000 });
      await expect(page).toHaveURL(/\/login/);
    }
  });
});
