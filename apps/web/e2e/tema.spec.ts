import path from 'node:path';
import type { Page } from '@playwright/test';
import { test, expect } from './mock-guard';
import { pastaEvidencias } from './evidencias';

/**
 * Tema claro/escuro/sistema (Configurações › Aparência), iPhone 13 contra o mock do Supabase:
 * vale na hora, não pisca ao recarregar, fica salvo na conta e segue a pessoa em outro aparelho.
 */

const MOCK_URL = 'http://127.0.0.1:54329';
const SENHA = 'senhaForte123';
const run = Date.now().toString(36);
const email = `tema.${run}@example.test`;
const pasta = pastaEvidencias('tema');
const foto = (page: Page, nome: string) => page.screenshot({ path: path.join(pasta, `${nome}.png`), fullPage: true });
const modo = (page: Page) => page.evaluate(() => document.documentElement.dataset.mode);

test.describe.configure({ mode: 'serial' });

async function fecharBannerInstalar(page: Page) {
  const banner = page.getByText('Instalar MeuDia').locator('xpath=ancestor::div[contains(@class,"fixed")][1]');
  if (await banner.isVisible().catch(() => false)) await banner.getByRole('button', { name: 'Fechar' }).click();
}

test('Aparência: Claro vale na hora, sem piscar ao recarregar, e segue a conta em outro aparelho', async ({ page, browser }) => {
  const erros: string[] = [];
  page.on('pageerror', (err) => erros.push(`${err.name}: ${err.message}`));
  // Registra o modo no DOMContentLoaded, antes do React: prova que não pisca o escuro.
  await page.addInitScript(() => {
    document.addEventListener('DOMContentLoaded', () => {
      (window as unknown as { __modoInicial?: string }).__modoInicial = document.documentElement.dataset.mode;
    });
  });

  await page.goto('/registro');
  await page.getByLabel('Nome').fill('Tema Teste');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Senha', { exact: true }).fill(SENHA);
  await page.getByLabel('Confirmar senha').fill(SENHA);
  await page.getByRole('button', { name: 'Criar conta' }).click();
  await page.waitForURL(/\/onboarding/);
  await page.getByRole('button', { name: 'Continuar' }).click();
  await page.getByLabel('Banco ou carteira 1').fill('Nubank');
  await page.getByLabel('Quanto tem hoje (1)').fill('30000');
  await page.getByRole('button', { name: 'Concluir' }).click();
  await page.waitForURL(/\/financas$/);
  await fecharBannerInstalar(page);

  // Quem nunca escolheu continua no escuro de sempre.
  expect(await modo(page)).toBe('dark');
  await page.getByTestId('linha-cofrinho').waitFor();
  await foto(page, 'inicio-escuro');

  await page.goto('/configuracoes');
  const grupo = page.getByRole('radiogroup', { name: 'Aparência' });
  await expect(grupo.getByRole('radio', { name: 'Escuro' })).toHaveAttribute('aria-checked', 'true');
  await foto(page, 'config-escuro');
  await grupo.getByRole('radio', { name: 'Claro' }).click();
  expect(await modo(page)).toBe('light');
  await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(246, 248, 251)');
  await expect(page.locator('meta[name="theme-color"]').first()).toHaveAttribute('content', '#f6f8fb');
  await foto(page, 'config-claro');

  // Recarregar: já nasce claro (antes da hidratação).
  await page.reload();
  expect(await page.evaluate(() => (window as unknown as { __modoInicial?: string }).__modoInicial)).toBe('light');
  await expect(grupo.getByRole('radio', { name: 'Claro' })).toHaveAttribute('aria-checked', 'true');

  // Telas principais no claro.
  await page.goto('/financas');
  await page.getByTestId('linha-cofrinho').waitFor();
  await foto(page, 'inicio-claro');
  await page.goto('/financas/carteiras');
  await page.getByTestId('card-cofrinho').waitFor();
  await foto(page, 'bancos-claro');
  await page.goto('/financas/gastos');
  await page.waitForLoadState('networkidle');
  await foto(page, 'gastos-claro');

  // Salvo na conta.
  const estado = await (await fetch(`${MOCK_URL}/__mock/state`)).json();
  const conta = estado.users.find((u: { email: string }) => u.email === email);
  expect(conta.user_metadata.tema).toBe('claro');

  // Outro aparelho (sem nada salvo): depois de entrar, a escolha da conta vale.
  const outro = await browser.newContext({ baseURL: 'http://localhost:3105', bypassCSP: true, locale: 'pt-BR' });
  const p2 = await outro.newPage();
  await p2.goto('/login');
  expect(await modo(p2)).toBe('dark');
  await p2.getByPlaceholder('seu@email.com').fill(email);
  await p2.locator('#senha').fill(SENHA);
  await p2.getByRole('button', { name: 'Entrar' }).click();
  await p2.waitForURL(/\/financas/);
  await expect.poll(() => modo(p2)).toBe('light');
  await outro.close();

  expect(erros, 'erros de JS').toEqual([]);
});

test('Aparência: Sistema segue o modo do celular, inclusive quando ele muda', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/login');
  await page.getByPlaceholder('seu@email.com').fill(email);
  await page.locator('#senha').fill(SENHA);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await page.waitForURL(/\/financas/);
  await page.goto('/configuracoes');
  const grupo = page.getByRole('radiogroup', { name: 'Aparência' });
  await grupo.getByRole('radio', { name: 'Sistema' }).click();
  expect(await modo(page)).toBe('dark');
  await page.emulateMedia({ colorScheme: 'light' });
  await expect.poll(() => modo(page)).toBe('light');
  // Volta ao escuro para não deixar a conta de teste no "sistema".
  await grupo.getByRole('radio', { name: 'Escuro' }).click();
  expect(await modo(page)).toBe('dark');
});
