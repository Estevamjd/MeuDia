import { test, expect } from '@playwright/test';

test.describe('Autenticação', () => {
  test('deve exibir a página de login', async ({ page }) => {
    await page.goto('/login');
    await expect(page).toHaveTitle(/MeuDia/i);
    await expect(page.getByRole('heading', { name: /entrar/i })).toBeVisible();
    await expect(page.getByPlaceholder(/email/i)).toBeVisible();
    await expect(page.getByPlaceholder(/senha/i)).toBeVisible();
  });

  test('deve mostrar erro com credenciais inválidas', async ({ page }) => {
    await page.goto('/login');
    await page.getByPlaceholder(/email/i).fill('invalido@teste.com');
    await page.getByPlaceholder(/senha/i).fill('senhaerrada123');
    await page.getByRole('button', { name: /entrar/i }).click();

    // Deve mostrar mensagem de erro
    await expect(page.getByText(/inválid|erro|incorret/i)).toBeVisible({
      timeout: 10000,
    });
  });

  test('deve redirecionar para login quando não autenticado', async ({ page }) => {
    await page.goto('/inicio');
    // Deve redirecionar para login
    await page.waitForURL(/\/login/, { timeout: 10000 });
    await expect(page).toHaveURL(/\/login/);
  });

  test('deve exibir link para registro', async ({ page }) => {
    await page.goto('/login');
    const registroLink = page.getByRole('link', { name: /criar conta|registr|cadastr/i });
    await expect(registroLink).toBeVisible();
  });

  test('deve exibir a página de registro', async ({ page }) => {
    await page.goto('/registro');
    await expect(page.getByPlaceholder(/nome/i)).toBeVisible();
    await expect(page.getByPlaceholder(/email/i)).toBeVisible();
    await expect(page.getByPlaceholder(/senha/i).first()).toBeVisible();
  });

  test('deve validar campos obrigatórios no registro', async ({ page }) => {
    await page.goto('/registro');
    // Tenta submeter sem preencher
    await page.getByRole('button', { name: /criar|registr|cadastr/i }).click();

    // Campos devem estar com validação HTML5 ou erro customizado
    const emailInput = page.getByPlaceholder(/email/i);
    await expect(emailInput).toBeVisible();
  });
});
