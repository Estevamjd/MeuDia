import { test, expect } from '@playwright/test';

/**
 * Testes de navegação básica (sem autenticação).
 * Verifica que as rotas públicas funcionam e redirecionam corretamente.
 */
test.describe('Navegação', () => {
  test('raiz redireciona para login ou finanças', async ({ page }) => {
    await page.goto('/');
    await page.waitForURL(/\/(login|financas)/, { timeout: 10000 });
    const url = page.url();
    expect(url).toMatch(/\/(login|financas)/);
  });

  test('páginas do dashboard redirecionam para login', async ({ page }) => {
    const dashboardPages = [
      '/treinos',
      '/financas',
      '/assinaturas',
      '/saude',
    ];

    for (const path of dashboardPages) {
      await page.goto(path);
      await page.waitForURL(/\/login/, { timeout: 10000 });
      expect(page.url()).toContain('/login');
    }
  });

  test('página 404 para rota inexistente', async ({ page }) => {
    const response = await page.goto('/rota-que-nao-existe');
    // Next.js retorna 404 para rotas inexistentes
    expect(response?.status()).toBe(404);
  });
});
