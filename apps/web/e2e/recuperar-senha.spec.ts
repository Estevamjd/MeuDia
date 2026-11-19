import path from 'node:path';
import { test, expect } from './mock-guard';
import { pastaEvidencias } from './evidencias';

/**
 * "Esqueceu a senha?": link no /login → pedido (mensagem genérica, sem revelar se o e-mail existe) →
 * link do e-mail (fluxo implícito, tokens no #) → /nova-senha → entra com a senha nova. Link vencido avisa. Só mock.
 */
const MOCK_URL = 'http://127.0.0.1:54329';
const run = Date.now().toString(36);
const EMAIL = `reset.${run}@example.test`;
const SENHA_ANTIGA = 'senhaAntiga123';
const SENHA_NOVA = 'senhaNova456';
const GENERICA = /Se existir uma conta com esse e-mail/;

test('recuperar senha: pedido genérico, link abre /nova-senha e a senha nova entra', async ({ page, request }) => {
  const pasta = pastaEvidencias('recuperar-senha');
  const shot = (nome: string) => page.screenshot({ path: path.join(pasta, nome), animations: 'disabled' });

  // Conta de teste direto no mock (autoconfirm).
  const cad = await request.post(`${MOCK_URL}/auth/v1/signup`, { data: { email: EMAIL, password: SENHA_ANTIGA, data: { nome: 'Lia Reset' } } });
  expect(cad.ok()).toBeTruthy();

  await page.goto('/login');
  await page.getByRole('link', { name: 'Esqueceu a senha?' }).click();
  await page.waitForURL(/\/esqueci-senha$/);
  await expect(page.getByRole('heading', { name: 'Esqueceu a senha?' })).toBeVisible();

  // E-mail inválido: validação no formulário.
  await page.getByLabel('Email').fill('nao-e-email');
  await page.getByRole('button', { name: 'Enviar link' }).click();
  await expect(page.getByText('Email inválido')).toBeVisible();

  // E-mail sem conta: mesma mensagem de sucesso.
  await page.getByLabel('Email').fill(`ninguem.${run}@example.test`);
  await page.getByRole('button', { name: 'Enviar link' }).click();
  await expect(page.getByText(GENERICA)).toBeVisible();

  await page.goto('/esqueci-senha');
  await page.getByLabel('Email').fill(EMAIL);
  await page.getByRole('button', { name: 'Enviar link' }).click();
  await expect(page.getByText(GENERICA)).toBeVisible();
  await shot('pedido-enviado-390.png');

  const { pedidos } = await (await request.get(`${MOCK_URL}/__mock/recover`)).json();
  const meu = pedidos.filter((p: { email: string }) => p.email === EMAIL).at(-1);
  expect(meu.redirect_to).toMatch(/\/nova-senha$/);
  expect(meu.pkce).toBe(false); // implícito: o link funciona em outro navegador/aparelho

  // Link vencido.
  await page.goto('/nova-senha#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired');
  await expect(page.getByText(/Este link não vale mais/)).toBeVisible();
  await expect(page).toHaveURL(/\/nova-senha$/);
  await page.getByRole('link', { name: 'Pedir novo link' }).click();
  await page.waitForURL(/\/esqueci-senha/);

  // Sem link nenhum.
  await page.goto('/nova-senha');
  await expect(page.getByText(/Este link não vale mais/)).toBeVisible();

  // Link do e-mail caindo no /login (Site URL sem a lista de redirects): segue para /nova-senha.
  const { hash } = await (await request.get(`${MOCK_URL}/__mock/recovery-link?email=${encodeURIComponent(EMAIL)}`)).json();
  await page.goto(`/login${hash}`);
  await page.waitForURL(/\/nova-senha/);
  await expect(page.getByLabel('Nova senha', { exact: true })).toBeVisible();
  await expect(page).toHaveURL(/\/nova-senha$/); // tokens saem da barra de endereço

  await page.getByLabel('Nova senha', { exact: true }).fill('curta1');
  await page.getByLabel('Confirmar nova senha').fill('curta1');
  await page.getByRole('button', { name: 'Salvar nova senha' }).click();
  await expect(page.getByText('Mínimo de 8 caracteres')).toBeVisible();

  await page.getByLabel('Nova senha', { exact: true }).fill(SENHA_NOVA);
  await page.getByLabel('Confirmar nova senha').fill(SENHA_NOVA + 'x');
  await page.getByRole('button', { name: 'Salvar nova senha' }).click();
  await expect(page.getByText('As senhas não coincidem')).toBeVisible();

  await page.getByLabel('Confirmar nova senha').fill(SENHA_NOVA);
  await shot('nova-senha-390.png');
  await page.getByRole('button', { name: 'Salvar nova senha' }).click();
  await expect(page.getByText('Senha alterada! Você já está dentro da sua conta.')).toBeVisible();
  await page.getByRole('button', { name: 'Ir para o MeuDia' }).click();
  await page.waitForURL((u) => !/\/(login|nova-senha)/.test(u.pathname));

  // A senha antiga não entra mais; a nova entra.
  const antiga = await request.post(`${MOCK_URL}/auth/v1/token?grant_type=password`, { data: { email: EMAIL, password: SENHA_ANTIGA } });
  expect(antiga.status()).toBe(400);
  const nova = await request.post(`${MOCK_URL}/auth/v1/token?grant_type=password`, { data: { email: EMAIL, password: SENHA_NOVA } });
  expect(nova.ok()).toBeTruthy();
});
