import path from 'node:path';
import { test, expect } from './mock-guard';
import { pastaEvidencias } from './evidencias';

/**
 * Link do fim do onboarding no WhatsApp (/whatsapp?t=TOKEN, docs/whatsapp.md): quem não tem conta cria e,
 * ao entrar no painel, o WhatsApp é ligado sozinho (whatsapp_vincular). Link vencido explica o que fazer. Só mock.
 */
const MOCK_URL = 'http://127.0.0.1:54329';
const run = Date.now().toString(36);
const SENHA = 'senhaForte123';
const EMAIL = `whats.${run}@example.test`;
const TOKEN_OK = 'ab'.repeat(32).slice(0, 63) + '1';
const TOKEN_VENCIDO = 'cd'.repeat(32).slice(0, 63) + '0';

test('link do WhatsApp: cria a conta e liga o número; link vencido avisa', async ({ page }) => {
  const pasta = pastaEvidencias('whatsapp-onboarding');
  const shot = (nome: string) => page.screenshot({ path: path.join(pasta, nome), animations: 'disabled' });

  await page.goto('/whatsapp');
  await expect(page.getByText('Link incompleto.')).toBeVisible();

  await page.goto(`/whatsapp?t=${TOKEN_OK}`);
  await expect(page.getByRole('heading', { name: 'Seu MeuDia no WhatsApp' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Já tenho conta' })).toBeVisible();
  await shot('link-sem-conta-390.png');
  await page.getByRole('link', { name: 'Criar minha conta' }).click();
  await page.waitForURL(/\/registro/);

  await page.getByLabel('Nome').fill('Lia Whats');
  await page.getByLabel('Email').fill(EMAIL);
  await page.getByLabel('Senha', { exact: true }).fill(SENHA);
  await page.getByLabel('Confirmar senha').fill(SENHA);
  await page.getByRole('button', { name: 'Criar conta' }).click();
  await page.waitForURL(/\/onboarding/);
  await page.getByRole('button', { name: 'Pular por agora' }).click();
  await page.waitForURL(/\/financas$/);

  await expect(page.getByText('WhatsApp ligado! Pode mandar seus gastos e treinos por lá.')).toBeVisible();
  await shot('ligado-toast-390.png');
  const estado = await (await fetch(`${MOCK_URL}/__mock/state`)).json();
  const perfil = estado.tables.profiles.find((p: { email: string }) => p.email === EMAIL);
  expect(perfil.whatsapp).toBe('5500000000001');
  expect(await page.evaluate(() => localStorage.getItem('meudia:whatsapp-token'))).toBeNull();

  // Já logado: link vencido explica e não fica guardado.
  await page.goto(`/whatsapp?t=${TOKEN_VENCIDO}`);
  await expect(page.getByRole('alert').filter({ hasText: 'link' })).toHaveText('Esse link expirou ou já foi usado. Mande "oi" no WhatsApp que eu te mando outro.');
  expect(await page.evaluate(() => localStorage.getItem('meudia:whatsapp-token'))).toBeNull();
  await shot('link-vencido-390.png');
});
