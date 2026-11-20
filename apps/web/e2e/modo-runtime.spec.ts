import { test, expect } from './mock-guard';

// O build do mock roda SEM APP_MODE e o servidor sobe COM APP_MODE=financas (playwright.mock.config.ts).
// O layout raiz é estático (páginas públicas pré-renderizadas); o modo é lido por request em RuntimeAppConfig,
// nos layouts de (dashboard) e de onboarding. Se eles voltarem a ser pré-renderizados no build, o modo congela em
// "padrao" e este teste falha (bug do PR #10).
const MODO_FINANCAS = /mode\\?":\\?"financas/;
const MODO_PADRAO = /mode\\?":\\?"padrao/;

test('/login responde 200 e /onboarding entrega o modo financas lido em runtime', async ({ request }) => {
  const login = await request.get('/login');
  expect(login.status(), 'GET /login').toBe(200);

  const res = await request.get('/onboarding');
  expect(res.status(), 'GET /onboarding').toBe(200);
  const html = await res.text();
  expect(html, 'HTML do /onboarding contém mode":"financas').toMatch(MODO_FINANCAS);
  expect(html, 'HTML do /onboarding não contém mode":"padrao').not.toMatch(MODO_PADRAO);
});

test('rota do dashboard (logado) entrega o modo financas lido em runtime', async ({ page }) => {
  const email = `modo.${Date.now().toString(36)}@example.test`;
  await page.goto('/registro');
  await page.getByLabel('Nome').fill('Modo Runtime');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Senha', { exact: true }).fill('senhaForte123');
  await page.getByLabel('Confirmar senha').fill('senhaForte123');
  await page.getByRole('button', { name: 'Criar conta' }).click();
  await page.waitForURL(/\/onboarding/);

  // Mesmos cookies de sessão do navegador: o middleware deixa passar e o layout de (dashboard) renderiza no servidor.
  const res = await page.request.get('/financas', { maxRedirects: 0 });
  expect(res.status(), 'GET /financas logado').toBe(200);
  const html = await res.text();
  expect(html, 'HTML do /financas contém mode":"financas').toMatch(MODO_FINANCAS);
  expect(html, 'HTML do /financas não contém mode":"padrao').not.toMatch(MODO_PADRAO);
});
