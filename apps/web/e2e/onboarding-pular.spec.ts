import { test, expect } from './mock-guard';

/** "Pular por agora" no 1º passo do onboarding (modo Finanças) chega à home e não volta para /onboarding. */

const MOCK_URL = 'http://127.0.0.1:54329';
const EMAIL = `pular.${Date.now().toString(36)}@example.test`;
const SENHA = 'senhaForte123';

test('onboarding: "Pular por agora" conclui e vai para a home', async ({ page }) => {
  const erros: string[] = [];
  page.on('pageerror', (err) => erros.push(`${err.name}: ${err.message}`));

  await page.goto('/registro');
  await page.getByLabel('Nome').fill('Pula Teste');
  await page.getByLabel('Email').fill(EMAIL);
  await page.getByLabel('Senha', { exact: true }).fill(SENHA);
  await page.getByLabel('Confirmar senha').fill(SENHA);
  await page.getByRole('button', { name: 'Criar conta' }).click();

  await page.waitForURL(/\/onboarding/);
  await expect(page.getByLabel('Como podemos te chamar?')).toBeVisible();
  await page.getByRole('button', { name: 'Pular por agora' }).click();

  await page.waitForURL(/\/financas$/);
  await expect(page.getByRole('heading', { name: 'Início', level: 1 })).toBeVisible();
  for (let i = 0; i < 12; i++) {
    expect(new URL(page.url()).pathname, 'voltou para /onboarding').not.toMatch(/^\/onboarding/);
    await page.waitForTimeout(250);
  }

  const estado = await (await fetch(`${MOCK_URL}/__mock/state`)).json();
  const prof = estado.tables.profiles.find((p: { email: string }) => p.email === EMAIL);
  expect(prof.onboarding_feito).toBe(true);
  expect(erros).toEqual([]);
});
