import path from 'node:path';
import type { Locator, Page } from '@playwright/test';
import { test, expect } from './mock-guard';
import { pastaEvidencias } from './evidencias';

/**
 * Bug do iPhone: o painel do assistente cobria a tela e o X não era tocável.
 * iPhone 13 / WebKit contra o mock em memória do Supabase: o X precisa estar no viewport, visível,
 * não coberto (elementFromPoint no centro dele) e com ≥ 44px; fecha pelo X, pelo backdrop e pela alça.
 */

const run = Date.now().toString(36);
const EMAIL = `assistente.${run}@example.test`;
const SENHA = 'senhaForte123';

test.describe.configure({ mode: 'serial' });

/** O centro do alvo, no viewport, é o próprio alvo (ou um filho): nada por cima. */
async function naoCoberto(alvo: Locator) {
  return alvo.evaluate((el) => {
    const r = el.getBoundingClientRect();
    const topo = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return !!topo && (topo === el || el.contains(topo));
  });
}

async function conferirX(page: Page, x: Locator) {
  await expect(x).toBeVisible();
  const caixa = await x.boundingBox();
  const vp = page.viewportSize()!;
  expect(caixa, 'X sem caixa').not.toBeNull();
  expect(caixa!.width, 'largura do X ≥ 44px').toBeGreaterThanOrEqual(44);
  expect(caixa!.height, 'altura do X ≥ 44px').toBeGreaterThanOrEqual(44);
  expect(caixa!.x, 'X fora do viewport (esquerda)').toBeGreaterThanOrEqual(0);
  expect(caixa!.y, 'X fora do viewport (topo)').toBeGreaterThanOrEqual(0);
  expect(caixa!.x + caixa!.width, 'X fora do viewport (direita)').toBeLessThanOrEqual(vp.width);
  expect(caixa!.y + caixa!.height, 'X fora do viewport (rodapé)').toBeLessThanOrEqual(vp.height);
  expect(await naoCoberto(x), 'algo cobre o centro do X').toBe(true);
}

test('assistente no iPhone: X visível e tocável; fecha por X, backdrop e arraste', async ({ page }) => {
  const erros: string[] = [];
  page.on('pageerror', (err) => erros.push(`${err.name}: ${err.message}`));

  // ── Cadastro + onboarding mínimo ──────────────────────────────────────────
  await page.goto('/registro');
  await page.getByLabel('Nome').fill('Ana Assistente');
  await page.getByLabel('Email').fill(EMAIL);
  await page.getByLabel('Senha', { exact: true }).fill(SENHA);
  await page.getByLabel('Confirmar senha').fill(SENHA);
  await page.getByRole('button', { name: 'Criar conta' }).click();
  await page.waitForURL(/\/onboarding/);
  await page.getByRole('button', { name: 'Continuar' }).click();
  await page.getByLabel('Banco ou carteira 1').fill('Nubank');
  await page.getByLabel('Quanto tem hoje (1)').fill('10000');
  await page.getByRole('button', { name: 'Concluir' }).click();
  await page.waitForURL(/\/financas$/);

  // Banner "Instalar MeuDia" visível de propósito: o painel tem de ficar acima dele.
  await expect(page.getByText('Instalar MeuDia')).toBeVisible();

  const bottomNav = page.getByRole('navigation', { name: 'Navegação principal' });
  const gatilho = bottomNav.getByRole('button', { name: 'Chat' });
  const painel = page.getByRole('dialog', { name: 'Agente MeuDia' });
  const x = painel.getByRole('button', { name: 'Fechar assistente' });

  const abrir = async () => {
    await gatilho.click();
    await expect(painel).toBeVisible();
    // Fim da animação de entrada (slideUp 0.3s) antes de medir.
    await expect.poll(() => painel.evaluate((el) => el.getAnimations().length)).toBe(0);
  };

  // ── 1. Abre, X dentro do viewport e não coberto; o sheet não cobre o topo ──
  await abrir();
  await conferirX(page, x);
  const caixaPainel = (await painel.boundingBox())!;
  expect(caixaPainel.y, 'painel cobre o topo da tela').toBeGreaterThanOrEqual(56);
  expect(await page.evaluate(() => getComputedStyle(document.body).overflow), 'scroll do body travado').toBe('hidden');
  await page.screenshot({ path: path.join(pastaEvidencias('contas-saldo'), '09-assistente-aberto.png'), fullPage: false });

  // ── 2. Toca no X → fecha e o foco volta para o "Chat" da BottomNav ─────────
  await x.tap();
  await expect(painel).toBeHidden();
  await expect(gatilho).toBeFocused();
  expect(await page.evaluate(() => getComputedStyle(document.body).overflow), 'scroll do body destravado').not.toBe('hidden');

  // ── 3. Abre de novo e fecha tocando no backdrop (faixa acima do sheet) ─────
  await abrir();
  const backdrop = page.getByTestId('agente-backdrop');
  const vp = page.viewportSize()!;
  await backdrop.tap({ position: { x: vp.width / 2, y: 20 } });
  await expect(painel).toBeHidden();

  // ── 4. Abre e fecha arrastando a alça para baixo ──────────────────────────
  await abrir();
  const alca = page.getByTestId('agente-alca');
  const a = (await alca.boundingBox())!;
  const evento = (clientY: number) => ({ pointerId: 7, pointerType: 'touch', isPrimary: true, clientX: a.x + 20, clientY, bubbles: true });
  await alca.dispatchEvent('pointerdown', evento(a.y + 5));
  await alca.dispatchEvent('pointermove', evento(a.y + 160));
  await alca.dispatchEvent('pointerup', evento(a.y + 160));
  await expect(painel).toBeHidden();

  expect(erros, 'erros na página').toEqual([]);
});
