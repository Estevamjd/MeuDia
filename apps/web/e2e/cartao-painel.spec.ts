import path from 'node:path';
import type { Page } from '@playwright/test';
import { test, expect } from './mock-guard';
import { pastaEvidencias } from './evidencias';

/**
 * Início v5 (maço de cartões: Resumo · A conta · Meta só se houver meta) e Relatório → Painel, iPhone 13 contra o
 * mock do Supabase, no claro e no escuro. Relógio fixo em 18/10/2026 12:00 (SP); dados semeados por POST /__mock/seed.
 */

const MOCK_URL = 'http://127.0.0.1:54329';
const AGORA = '2026-10-18T15:00:00.000Z';
const SENHA = 'senhaForte123';
const run = Date.now().toString(36);
const brl = (valor: string) => new RegExp(`^R\\$\\s${valor.replace('.', '\\.')}$`);
const pasta = pastaEvidencias('cartao-maco');

test.describe.configure({ mode: 'serial' });
const relogio = (now: string | null) =>
  fetch(`${MOCK_URL}/__mock/clock`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ now }) });
test.beforeAll(() => relogio(AGORA));
test.afterAll(() => relogio(null));

async function cadastrar(page: Page, nome: string) {
  const email = `${nome.toLowerCase().replace(/\s/g, '.')}.${run}@example.test`;
  await page.clock.setFixedTime(new Date(AGORA));
  await page.goto('/registro');
  await page.getByLabel('Nome').fill(nome);
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
  await expect(page.getByText('Instalar MeuDia')).toBeVisible();
  return email;
}

async function semear(email: string, tables: Record<string, Record<string, unknown>[]>) {
  const res = await fetch(`${MOCK_URL}/__mock/seed`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, tables }) });
  expect(res.status, await res.clone().text()).toBe(200);
}

/** O banner "Instalar MeuDia" aparece ~2s após a carga; espera e fecha (depois de fechado, não volta). */
async function fecharBanner(page: Page) {
  const banner = page.getByText('Instalar MeuDia').locator('xpath=ancestor::div[contains(@class,"fixed")][1]');
  await banner.waitFor({ timeout: 5000 }).catch(() => {});
  if (await banner.isVisible().catch(() => false)) await banner.getByRole('button', { name: 'Fechar' }).click();
}

async function escolherModo(page: Page, nome: 'Claro' | 'Escuro') {
  await page.goto('/configuracoes');
  await page.getByRole('radiogroup', { name: 'Aparência' }).getByRole('radio', { name: nome }).click();
  await expect.poll(() => page.evaluate(() => document.documentElement.dataset.mode)).toBe(nome === 'Claro' ? 'light' : 'dark');
}

/** O cartão está na frente do maço: marcado como frente e assentado no centro do palco (sem giro, escala 1). */
const naFrente = async (page: Page, testid: string) => {
  const c = page.getByTestId(testid);
  await expect(c).toHaveClass(/cartao-frente/);
  await expect
    .poll(async () => {
      const b = await c.boundingBox();
      const largura = page.viewportSize()!.width;
      return !!b && Math.abs(b.x + b.width / 2 - largura / 2) < 2 && b.width <= 341;
    }, { message: `${testid} na frente` })
    .toBe(true);
};

/** Arrasta com o dedo (touch de verdade via CDP; só no Chromium), conferindo o maço no meio do gesto. */
async function arrastarCartao(page: Page, deX: number, ateX: number, y: number, noMeio: () => Promise<void>) {
  const cdp = await page.context().newCDPSession(page);
  const toque = (type: 'touchStart' | 'touchMove' | 'touchEnd', x: number) =>
    cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1, radiusX: 4, radiusY: 4, force: 1 }] });
  await toque('touchStart', deX);
  const passos = 12;
  for (let i = 1; i <= passos; i++) {
    await toque('touchMove', deX + ((ateX - deX) * i) / passos);
    await page.waitForTimeout(16);
    if (i === Math.round(passos * 0.6)) await noMeio();
  }
  await toque('touchEnd', ateX);
  await cdp.detach();
}

const semRolagemLateral = async (page: Page) =>
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);

test('maço de cartões: 2 sem meta, 3 com meta; formato de cartão (≤ 240px); arrastar, botões, setas e anúncio; Painel; claro e escuro', async ({ page, browserName }) => {
  const erros: string[] = [];
  page.on('pageerror', (err) => erros.push(`${err.name}: ${err.message}`));
  page.on('response', (res) => { if (res.status() >= 400) erros.push(`${res.request().method()} ${res.url()} → ${res.status()}`); });

  const email = await cadastrar(page, 'Lia Cartao');
  await semear(email, {
    rendas: [{ descricao: 'Salário', valor: 943, dia_recebimento: 5 }],
    contas_pagar: [
      { descricao: 'Curso', categoria: 'Educação', valor: 620, recorrencia: 'mensal', dia_vencimento: 5 },
      { descricao: 'Celular', categoria: 'Outros', valor: 124, recorrencia: 'mensal', dia_vencimento: 25 },
    ],
    transacoes: [{ tipo: 'despesa', descricao: 'Mercado', categoria: 'Mercado', valor: 59.9, data: '2026-10-12', created_at: '2026-10-12T12:00:00.000Z' }],
  });
  await page.reload();
  await fecharBanner(page);

  // ── Sem meta: 2 cartões (Resumo, A conta); a conta continua com os mesmos testids ──
  const cartao = page.getByTestId('cartao-resumo');
  const anuncio = cartao.locator('[aria-live="polite"]');
  await expect(cartao).toHaveAttribute('data-paginas', '2');
  await expect(page.getByTestId('cartao-pagina-meta')).toHaveCount(0);
  await expect(page.getByTestId('cartao-sobra-valor')).toHaveText(brl('139,10'));
  await expect(page.getByTestId('previsao-fim-mes-valor')).toHaveText(brl('139,10'));
  await expect(page.getByTestId('linha-cofrinho')).toBeVisible();
  await naFrente(page, 'cartao-pagina-resumo');
  // Formato de cartão de crédito: ≤ 240px de altura, razão ~1,586, e o maço inteiro cabe sem empurrar a Início.
  const caixa = (await page.getByTestId('cartao-pagina-resumo').boundingBox())!;
  expect(caixa.height).toBeLessThanOrEqual(240);
  expect(caixa.width / caixa.height).toBeGreaterThan(1.55);
  expect(caixa.width / caixa.height).toBeLessThan(1.62);
  expect((await page.getByTestId('cartao-maco').boundingBox())!.height).toBeLessThanOrEqual(250);
  await expect(page.getByRole('region', { name: 'Contas a vencer' })).toBeInViewport();
  await semRolagemLateral(page);

  // Arrastar com o dedo: no meio do gesto o cartão da frente está "na mão" (sobe e gira) e o de trás aparece.
  if (browserName === 'chromium') {
    const y = caixa.y + caixa.height / 2;
    await arrastarCartao(page, 330, 70, y, async () => {
      await expect(cartao).toHaveClass(/maco-segurando/);
      const giro = await page.getByTestId('cartao-pagina-resumo').evaluate((el) => (el as HTMLElement).style.transform);
      expect(giro).toMatch(/rotate\(-\d/);
      await page.screenshot({ path: path.join(pasta, '00-arrastando-escuro.png'), animations: 'disabled' });
    });
    await naFrente(page, 'cartao-pagina-conta');
    await expect(anuncio).toHaveText('Cartão 2 de 2: A conta');
    await expect(cartao).not.toHaveClass(/maco-segurando/);
    await page.getByRole('button', { name: 'Cartão anterior: Resumo' }).click();
    await naFrente(page, 'cartao-pagina-resumo');
  }

  await page.getByRole('button', { name: 'Próximo cartão: A conta' }).click();
  await naFrente(page, 'cartao-pagina-conta');
  await expect(anuncio).toHaveText('Cartão 2 de 2: A conta');
  await expect(page.getByTestId('cartao-posicao')).toHaveText('2 de 2 · A conta');
  await expect(page.getByRole('button', { name: 'Próximo cartão' })).toBeDisabled();
  // Contas fixas do cartão abrem a lista abaixo do maço.
  await page.getByRole('button', { name: /Contas fixas/ }).click();
  await expect(page.getByRole('list', { name: 'Contas fixas de outubro' })).toContainText('Curso');
  await page.getByRole('button', { name: /Contas fixas/ }).click();
  await page.screenshot({ path: path.join(pasta, '01-sem-meta-p2-escuro.png'), animations: 'disabled' });

  // ── Com meta: 3 páginas; linha da meta na página 1 e página Meta com os números ──
  await semear(email, {
    metas: [{ nome: 'Celular novo', icone: 'smartphone', valor_alvo: 2000, valor_guardado: 840, data_limite: '2027-03-31', criado_em: '2026-09-01T12:00:00.000Z' }],
  });
  for (const modo of ['Escuro', 'Claro'] as const) {
    const sufixo = modo === 'Claro' ? 'claro' : 'escuro';
    await escolherModo(page, modo);
    await page.goto('/financas');
    await fecharBanner(page);
    await expect(cartao).toHaveAttribute('data-paginas', '3');
    await expect(page.getByTestId('cartao-meta-mini')).toContainText('Celular novo');
    await semRolagemLateral(page);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: path.join(pasta, `02-inicio-p1-${sufixo}.png`), animations: 'disabled' });

    await naFrente(page, 'cartao-pagina-resumo');
    await page.getByRole('button', { name: 'Próximo cartão: A conta' }).click();
    await naFrente(page, 'cartao-pagina-conta');
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: path.join(pasta, `03-inicio-p2-${sufixo}.png`), animations: 'disabled' });

    // Setas do teclado no trilho levam à página Meta.
    await page.getByLabel('Cartões do resumo do mês. Deslize para o lado ou use as setas.').focus();
    await page.keyboard.press('ArrowRight');
    await naFrente(page, 'cartao-pagina-meta');
    await expect(anuncio).toHaveText('Cartão 3 de 3: Meta');
    await expect(page.getByTestId('cartao-meta-pct')).toContainText('42');
    await expect(page.getByTestId('cartao-meta-valores')).toHaveText(/R\$\s840,00 guardados de R\$\s2\.000,00/);
    await expect(page.getByRole('progressbar', { name: 'Meta Celular novo' })).toHaveAttribute('aria-valuenow', '42');
    await expect(cartao.getByRole('link', { name: 'Guardar', exact: true })).toHaveAttribute('href', '/financas/metas');
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: path.join(pasta, `04-inicio-p3-${sufixo}.png`), animations: 'disabled' });

    // ── Painel (antigo Relatório) ──
    await page.getByRole('navigation', { name: 'Navegação principal' }).getByRole('link', { name: 'Painel' }).click();
    await page.waitForURL(/\/financas\/relatorio$/);
    await expect(page.getByRole('heading', { level: 1 }).first()).toHaveText('Painel');
    await expect(page.getByTestId('painel-sobra-valor')).toHaveText(brl('139,10'));
    for (const nome of ['Para onde vai o salário', 'Para onde foi seu dinheiro', 'Seu mês dia a dia']) await expect(page.getByRole('region', { name: nome })).toBeVisible();
    await page.getByTestId('painel-dia-a-dia').locator('svg').first().waitFor();
    await semRolagemLateral(page);
    await page.screenshot({ path: path.join(pasta, `05-painel-${sufixo}.png`), fullPage: true, animations: 'disabled' });
  }

  expect(erros, 'erros na página ou respostas HTTP ≥ 400').toEqual([]);
});
