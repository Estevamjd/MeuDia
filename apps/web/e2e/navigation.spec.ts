import { test, expect } from '@playwright/test';

/**
 * Testes de navegação básica (sem autenticação).
 * Verifica que as rotas públicas funcionam e redirecionam corretamente.
 */
test.describe('Navegação', () => {
  test('raiz redireciona para login ou inicio', async ({ page }) => {
    await page.goto('/');
    await page.waitForURL(/\/(login|inicio)/, { timeout: 10000 });
    const url = page.url();
    expect(url).toMatch(/\/(login|inicio)/);
  });

  test('páginas do dashboard redirecionam para login', async ({ page }) => {
    const dashboardPages = [
      '/inicio',
      '/treinos',
      '/habitos',
      '/dieta',
      '/financas',
      '/agenda',
      '/compras',
      '/medicamentos',
      '/veiculo',
      '/assinaturas',
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
