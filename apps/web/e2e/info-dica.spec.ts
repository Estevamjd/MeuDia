import type { Page } from '@playwright/test';
import { test, expect } from './mock-guard';
import { vigiarErros } from './vigia-erros';

/**
 * Wave 3E: ⓘ da Início (iPhone 13 WebKit, mock do Supabase, 390px). O toque abre a explicação, o texto é o de
 * explicacoes.ts, o maço não passa de cartão, Esc fecha e devolve o foco. Com PRINTS_DIR, salva prints locais.
 * Relógio fixo em 20/11/2026 (SP): 11 dias contando hoje; 2.090 ÷ 11 = R$ 190,00 por dia.
 */

const MOCK_URL = 'http://127.0.0.1:54329';
const AGORA = '2026-11-20T15:00:00.000Z';
const SENHA = 'senhaForte123';
const run = Date.now().toString(36);
const PRINTS = process.env.PRINTS_DIR;

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
  return email;
}

async function semear(email: string, tables: Record<string, Record<string, unknown>[]>) {
  const res = await fetch(`${MOCK_URL}/__mock/seed`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, tables }) });
  expect(res.status, await res.clone().text()).toBe(200);
}

async function fecharBanner(page: Page) {
  const banner = page.getByText('Instalar MeuDia').locator('xpath=ancestor::div[contains(@class,"fixed")][1]');
  await banner.waitFor({ timeout: 5000 }).catch(() => {});
  if (await banner.isVisible().catch(() => false)) await banner.getByRole('button', { name: 'Fechar' }).click();
}

async function irParaRitmo(page: Page) {
  await page.goto('/financas');
  await fecharBanner(page);
  await expect(page.getByTestId('cartao-pagina-resumo')).toHaveClass(/cartao-frente/);
  await page.getByRole('button', { name: 'Próximo cartão: Ritmo' }).click();
  await expect(page.getByTestId('cartao-pagina-conta')).toHaveClass(/cartao-frente/);
  // Espera o maço assentar (a rolagem suave do botão) antes de medir/fotografar.
  await page.waitForTimeout(700);
}

const print = async (page: Page, nome: string) => {
  if (PRINTS) await page.screenshot({ path: `${PRINTS}/local-${nome}.png` });
};

test('ⓘ da Início: abre a explicação do "Pode gastar por dia" a 390px, sem passar o cartão, e Esc fecha', async ({ page }) => {
  const vigia = await vigiarErros(page);
  await page.setViewportSize({ width: 390, height: 844 });
  const email = await cadastrar(page, 'Bia Dica');
  // Renda 3.000 − contas 700 − gastos 210 = deve sobrar 2.090; 20 a 30/11 = 11 dias → R$ 190,00 por dia.
  await semear(email, {
    rendas: [{ descricao: 'Salário', valor: 3000, dia_recebimento: 5 }],
    contas_pagar: [{ descricao: 'Aluguel', categoria: 'Moradia', valor: 700, recorrencia: 'mensal', dia_vencimento: 25 }],
    transacoes: [{ tipo: 'despesa', descricao: 'Mercado', categoria: 'Mercado', valor: 210, data: '2026-11-12', created_at: '2026-11-12T12:00:00.000Z' }],
    metas: [{ nome: 'Viagem', icone: 'plane', valor_alvo: 3000, valor_guardado: 900, data_limite: '2027-06-30', criado_em: '2026-09-01T12:00:00.000Z' }],
  });

  await irParaRitmo(page);
  const conta = page.getByTestId('cartao-pagina-conta');
  await expect(conta.getByText('Pode gastar por dia')).toBeVisible();
  await expect(page.getByTestId('cartao-ritmo-dia')).toHaveText(/^R\$\s190,00$/);
  await expect(page.getByTestId('cartao-ritmo-conta')).toHaveText(/^R\$\s2\.090,00 que sobram ÷ 11 dias$/);
  await print(page, 'ritmo-escuro');

  const botao = conta.getByRole('button', { name: 'O que é Pode gastar por dia?' });
  // Área de toque ≥ 44×44 (o ::before) com o desenho pequeno.
  const area = await botao.evaluate((el) => {
    const r = el.getBoundingClientRect();
    const antes = getComputedStyle(el, '::before');
    return { w: r.width, h: r.height, aw: r.width - 2 * parseFloat(antes.left), ah: r.height - 2 * parseFloat(antes.top) };
  });
  expect(area.w).toBeLessThanOrEqual(16);
  expect(area.aw).toBeGreaterThanOrEqual(44);
  expect(area.ah).toBeGreaterThanOrEqual(44);

  // Conta do Ritmo (4 ⓘ empilhados) e "Por mês" da Meta: 44 de largura; altura ≥ 24 (a da linha) sem sobrepor o vizinho,
  // a 390 e a 360px; conteúdo dentro do cartão.
  for (const largura of [390, 360]) {
    await page.setViewportSize({ width: largura, height: 844 });
    await page.waitForTimeout(300);
    const m = await conta.evaluate((c) => {
      const cartao = c.querySelector('.lap-heroi')!.getBoundingClientRect();
      const areas = [...c.querySelectorAll('dl [data-testid="info-dica"]')].map((el) => {
        const r = el.getBoundingClientRect();
        const a = getComputedStyle(el, '::before');
        return { top: r.top + parseFloat(a.top), bottom: r.bottom - parseFloat(a.bottom), w: r.width - parseFloat(a.left) - parseFloat(a.right) };
      });
      return { areas, fimDl: c.querySelector('dl')!.getBoundingClientRect().bottom, fimCartao: cartao.bottom };
    });
    expect(m.areas, `${largura}`).toHaveLength(4);
    for (const [i, a] of m.areas.entries()) {
      expect(a.w, `${largura} #${i}`).toBeGreaterThanOrEqual(44);
      expect(a.bottom - a.top, `${largura} #${i}`).toBeGreaterThanOrEqual(i === 0 ? 44 : i === 3 ? 37 : 24);
      if (i > 0) expect(a.top, `${largura}: #${i} não cobre #${i - 1}`).toBeGreaterThanOrEqual(m.areas[i - 1]!.bottom - 0.5);
    }
    expect(m.areas[3]!.bottom).toBeLessThanOrEqual(m.fimCartao + 0.5);
    expect(m.fimDl).toBeLessThanOrEqual(m.fimCartao);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(300);

  await botao.tap();
  const caixa = page.getByRole('dialog', { name: 'Pode gastar por dia' });
  await expect(caixa).toBeVisible();
  await expect(caixa).toContainText('dividido pelos dias que faltam, contando hoje. Gastando até isso por dia, a sobra prevista não acaba antes do fim do mês');
  await expect(botao).toHaveAttribute('aria-expanded', 'true');
  // Inteira dentro da tela de 390px.
  const b = (await caixa.boundingBox())!;
  expect(b.x).toBeGreaterThanOrEqual(0);
  expect(b.x + b.width).toBeLessThanOrEqual(390);
  // O toque no ⓘ não passou o cartão.
  await expect(conta).toHaveClass(/cartao-frente/);
  await print(page, 'dica-escuro');

  // O Esc sai do foco dentro da caixa (ela recebe o foco ao abrir).
  await expect(caixa).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(caixa).toHaveCount(0);
  await expect(botao).toHaveAttribute('aria-expanded', 'false');
  await expect(botao).toBeFocused();
  await expect(conta).toHaveClass(/cartao-frente/);

  // Toque fora também fecha.
  await page.getByRole('button', { name: 'O que é Contas a vencer?' }).tap();
  await expect(page.getByRole('dialog', { name: 'Contas a vencer' })).toContainText('Contas fixas deste mês que ainda não têm Paguei');
  await page.mouse.click(195, 30);
  await expect(page.getByRole('dialog', { name: 'Contas a vencer' })).toHaveCount(0);

  if (PRINTS) {
    // Claro e Cor do app laranja (só os prints; as regras de tema e cor têm os seus specs).
    await page.goto('/configuracoes');
    await page.getByRole('radiogroup', { name: 'Aparência' }).getByRole('radio', { name: 'Claro' }).click();
    await irParaRitmo(page);
    await print(page, 'ritmo-claro');
    await page.getByTestId('cartao-pagina-conta').getByRole('button', { name: 'O que é Gastos do mês?' }).tap();
    await print(page, 'dica-claro');
    await page.keyboard.press('Escape');
    await page.goto('/configuracoes');
    await page.getByRole('radiogroup', { name: 'Aparência' }).getByRole('radio', { name: 'Escuro' }).click();
    await page.getByRole('radiogroup', { name: 'Cor do app' }).getByRole('radio', { name: 'Laranja' }).click();
    await expect(page.locator('html')).toHaveAttribute('data-accent', 'laranja');
    await page.goto('/financas');
    await fecharBanner(page);
    await page.getByTestId('cartao-pagina-resumo').getByRole('button', { name: 'O que é Deve sobrar?' }).tap();
    await print(page, 'dica-laranja');
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'O que é A receber?' }).scrollIntoViewIfNeeded().catch(() => {});
    await page.getByRole('button', { name: 'O que é Para onde foi?' }).tap();
    await print(page, 'dica-laranja-para-onde-foi');
    await page.goto('/configuracoes');
    await page.getByRole('radiogroup', { name: 'Cor do app' }).getByRole('radio', { name: 'Ciano' }).click();
  }
  expect(vigia.erros(), vigia.relatorio()).toEqual([]);
});
