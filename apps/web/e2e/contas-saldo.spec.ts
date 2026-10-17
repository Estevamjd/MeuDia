import path from 'node:path';
import type { Locator } from '@playwright/test';
import { test, expect } from './mock-guard';
import { pastaEvidencias } from './evidencias';

/**
 * Aceite do BRIEF §5 "Contas, saldo e dashboard" (iPhone 13 / WebKit) contra o mock em memória do Supabase.
 * Relógio fixo em 17/10/2026 12:00 (America/Sao_Paulo) no navegador (page.clock) e no mock (/__mock/clock).
 * Screenshots full-page (e de viewport, sufixo -viewport, sem header/BottomNav no meio da imagem) em
 * EVIDENCIAS_DIR (padrão em e2e/evidencias.ts; não versionados).
 */

const MOCK_URL = 'http://127.0.0.1:54329';
const AGORA = '2026-10-17T15:00:00.000Z'; // 12:00 em São Paulo (UTC−3)

const run = Date.now().toString(36);
const EMAIL = `bia.${run}@example.test`;
const SENHA = 'senhaForte123';

/** "R$ 1.555,00" tolerando o NBSP do Intl. */
const brl = (valor: string) => new RegExp(`^R\\$\\s${valor.replace('.', '\\.')}$`);

test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
  await fetch(`${MOCK_URL}/__mock/clock`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ now: AGORA }) });
});
test.afterAll(async () => {
  // Devolve o relógio real para os demais specs do mesmo mock.
  await fetch(`${MOCK_URL}/__mock/clock`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ now: null }) });
});

test('contas e saldo: 2 bancos, entrada extra, contas, transferência, Gastei, renda e Recebi', async ({ page }) => {
  const EVIDENCIAS = pastaEvidencias('contas-saldo');
  await page.clock.setFixedTime(new Date(AGORA));

  const erros: string[] = [];
  page.on('pageerror', (err) => erros.push(`${err.name}: ${err.message}`));
  page.on('response', (res) => {
    if (res.status() >= 400) erros.push(`${res.request().method()} ${res.url()} → ${res.status()}`);
  });

  const shot = (nome: string, fullPage = true) => page.screenshot({ path: path.join(EVIDENCIAS, nome), fullPage, animations: 'disabled' });
  const tocar = async (alvo: Locator) => {
    await alvo.evaluate((el) => el.scrollIntoView({ block: 'center' }));
    await alvo.click();
  };
  const confirmarToast = async (texto: string) => {
    const alerta = page.getByRole('alert').filter({ hasText: texto });
    await expect(alerta).toBeVisible();
    await alerta.getByRole('button', { name: 'Fechar notificação' }).click();
    await expect(alerta).toBeHidden();
  };
  const bottomNav = page.getByRole('navigation', { name: 'Navegação principal' });
  const hoje = page.getByTestId('saldo-hoje-valor');
  const seteDias = page.getByTestId('previsao-7dias-valor');
  const fimMes = page.getByTestId('previsao-fim-mes-valor');
  const chips = page.getByRole('list', { name: 'Saldo por banco' });
  const semScrollHorizontal = async () => {
    const { scroll, largura } = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, largura: window.innerWidth }));
    expect(scroll, 'scroll horizontal em 390px').toBeLessThanOrEqual(largura);
  };
  const abrirAcao = async (acao: RegExp) => {
    await bottomNav.getByRole('button', { name: 'Lançar' }).click();
    const menu = page.getByRole('dialog', { name: 'O que aconteceu?' });
    await expect(menu).toBeVisible();
    await menu.getByRole('button', { name: acao }).click();
    return page.getByRole('dialog');
  };

  // ── Cadastro + onboarding "Onde fica seu dinheiro?" ─────────────────────────
  await page.goto('/registro');
  await page.getByLabel('Nome').fill('Bia Teste');
  await page.getByLabel('Email').fill(EMAIL);
  await page.getByLabel('Senha', { exact: true }).fill(SENHA);
  await page.getByLabel('Confirmar senha').fill(SENHA);
  await page.getByRole('button', { name: 'Criar conta' }).click();
  await page.waitForURL(/\/onboarding/);
  await expect(page.getByLabel('Como podemos te chamar?')).toHaveValue('Bia Teste');
  await page.getByRole('button', { name: 'Continuar' }).click();
  await expect(page.getByRole('heading', { name: 'Onde fica seu dinheiro?' })).toBeVisible();
  await page.getByLabel('Banco ou carteira 1').fill('Nubank');
  await page.getByLabel('Quanto tem hoje (1)').fill('65000');
  await expect(page.getByLabel('Quanto tem hoje (1)')).toHaveValue(brl('650,00'));
  await page.getByRole('button', { name: 'adicionar outro' }).click();
  await page.getByLabel('Banco ou carteira 2').fill('Caixa');
  await page.getByLabel('Quanto tem hoje (2)').fill('5000');
  await shot('01-onboarding-carteiras.png');
  await page.getByRole('button', { name: 'Concluir' }).click();
  await page.waitForURL(/\/financas$/);

  // Banner "Instalar MeuDia" (iOS, após 2s): fecha para não cobrir as evidências full-page.
  const banner = page.getByText('Instalar MeuDia').locator('xpath=ancestor::div[contains(@class,"fixed")][1]');
  await expect(banner).toBeVisible();
  await banner.getByRole('button', { name: 'Fechar' }).click();
  await expect(banner).toBeHidden();

  // 1. Nubank 650 + Caixa 50 → Hoje R$ 700.
  await expect(hoje).toHaveText(brl('700,00'));
  await expect(chips).toContainText(/Nubank\s*R\$\s650,00/);
  await expect(chips).toContainText(/Caixa\s*R\$\s50,00/);

  // 2. Entrou dinheiro R$ 100 na Caixa → R$ 800 (Nubank 650 · Caixa 150).
  let folha = await abrirAcao(/Entrou dinheiro/);
  await expect(folha).toHaveAccessibleName('Entrou dinheiro');
  await folha.getByLabel('Valor').fill('10000');
  await folha.getByRole('radiogroup', { name: 'Entrou em' }).getByRole('radio', { name: 'Caixa' }).click();
  await expect(folha.getByRole('radiogroup', { name: 'Entrou em' }).getByRole('radio', { name: 'Caixa' })).toHaveAttribute('aria-checked', 'true');
  await folha.getByLabel('De onde veio? (opcional)').fill('Freela');
  await shot('04-entrou-dinheiro.png');
  await folha.getByRole('button', { name: 'Salvar entrada' }).click();
  await confirmarToast('Entrada salva');
  await expect(hoje).toHaveText(brl('800,00'));
  await expect(chips).toContainText(/Nubank\s*R\$\s650,00/);
  await expect(chips).toContainText(/Caixa\s*R\$\s150,00/);

  // 3. Contas pendentes: luz R$ 120 (20/10) e internet R$ 100 (25/10).
  await bottomNav.getByRole('link', { name: 'Contas' }).click();
  await page.waitForURL(/\/financas\/contas$/);
  await page.waitForLoadState('networkidle');
  for (const [nome, valor, dia] of [['Luz', '120', '20'], ['Internet', '100', '25']] as const) {
    await tocar(page.getByRole('button', { name: 'Nova conta' }).first());
    const modal = page.getByRole('dialog', { name: 'Nova conta' });
    await expect(modal).toBeVisible();
    await modal.getByLabel('Nome').fill(nome);
    await modal.getByLabel('Valor (R$)').fill(valor);
    await modal.getByLabel('Dia do vencimento').fill(dia);
    await tocar(modal.getByRole('radio', { name: nome }));
    await expect(modal.getByRole('radio', { name: nome })).toHaveAttribute('aria-checked', 'true');
    await modal.getByRole('button', { name: 'Salvar' }).click();
    await confirmarToast('Conta criada!');
    await expect(modal).toBeHidden();
  }
  await bottomNav.getByRole('link', { name: 'Início' }).click();
  await page.waitForURL(/\/financas$/);
  await expect(hoje).toHaveText(brl('800,00'));
  await expect(seteDias).toHaveText(brl('680,00'));
  await expect(fimMes).toHaveText(brl('580,00'));

  // 4. Transferir R$ 50 Caixa → Nubank: total igual, Nubank 700 · Caixa 100; gasto do mês não muda.
  folha = await abrirAcao(/Transferir/);
  await folha.getByLabel('Valor').fill('5000');
  await folha.getByRole('radiogroup', { name: 'De' }).getByRole('radio', { name: 'Caixa' }).click();
  await folha.getByRole('radiogroup', { name: 'Para' }).getByRole('radio', { name: 'Nubank' }).click();
  await expect(folha.getByRole('radiogroup', { name: 'De' }).getByRole('radio', { name: 'Caixa' })).toHaveAttribute('aria-checked', 'true');
  await expect(folha.getByRole('radiogroup', { name: 'Para' }).getByRole('radio', { name: 'Nubank' })).toHaveAttribute('aria-checked', 'true');
  await shot('05-transferir.png');
  await folha.getByRole('button', { name: 'Transferir' }).click();
  await confirmarToast('Transferência feita');
  await expect(hoje).toHaveText(brl('800,00'));
  await expect(chips).toContainText(/Nubank\s*R\$\s700,00/);
  await expect(chips).toContainText(/Caixa\s*R\$\s100,00/);
  await expect(page.getByText('Nenhum gasto neste mês ainda.', { exact: false })).toBeVisible();

  // 5. Gastei R$ 25 em Comida no Nubank → Hoje 775, rosca Comida 25, fim do mês 555.
  folha = await abrirAcao(/Gastei/);
  await folha.getByLabel('Valor').fill('2500');
  await tocar(folha.getByRole('radio', { name: 'Comida' }));
  const nubankGasto = folha.getByRole('radiogroup', { name: 'Saiu de' }).getByRole('radio', { name: 'Nubank' });
  await nubankGasto.click();
  await expect(nubankGasto).toHaveAttribute('aria-checked', 'true');
  await expect(folha.getByRole('radio', { name: 'Comida' })).toHaveAttribute('aria-checked', 'true');
  await shot('03-gastei.png');
  await folha.getByRole('button', { name: 'Salvar gasto' }).click();
  await confirmarToast('Gasto salvo');
  await expect(hoje).toHaveText(brl('775,00'));
  await expect(page.getByRole('list', { name: 'Legenda dos gastos por categoria' })).toContainText(/Comida\s*R\$\s25,00/);
  await expect(fimMes).toHaveText(brl('555,00'));

  // 6. Só agora a renda: R$ 900 dia 5 → a renda a receber entra na previsão.
  await tocar(page.getByRole('button', { name: 'Cadastrar minha renda' }));
  const modalRenda = page.getByRole('dialog', { name: 'Sua renda do mês' });
  await modalRenda.getByLabel('Valor').fill('90000');
  await modalRenda.getByLabel('Dia que recebe (opcional)').fill('5');
  await modalRenda.getByRole('button', { name: 'Salvar' }).click();
  await confirmarToast('Renda salva');
  await expect(hoje).toHaveText(brl('775,00'));
  await expect(seteDias).toHaveText(brl('1.555,00'));
  await expect(fimMes).toHaveText(brl('1.455,00'));
  await semScrollHorizontal();
  await shot('02-home-dashboard.png');
  // Viewport (o que a usuária vê no iPhone): topo da home e rolada até os gráficos.
  await page.evaluate(() => window.scrollTo(0, 0));
  await shot('02-home-dashboard-viewport.png', false);
  await page.getByRole('region', { name: 'Gastos do mês por categoria' }).evaluate((el) => el.scrollIntoView({ block: 'start' }));
  await page.evaluate(() => window.scrollBy(0, -72)); // folga para o header fixo não cobrir o título do card
  await shot('02b-home-graficos-viewport.png', false);

  // "por quê?" do 7 dias: conta em português.
  await tocar(page.getByRole('button', { name: 'por quê? Em 7 dias você terá' }));
  const explicacao = page.getByRole('region', { name: 'Em 7 dias você terá' });
  await expect(explicacao).toContainText(/Você tem hoje\s*R\$\s775,00/);
  await expect(explicacao).toContainText(/Renda principal \(a receber 05\/10\)/);
  await expect(explicacao).toContainText(/Luz \(vence 20\/10\)/);
  await expect(explicacao).not.toContainText('Internet');
  await explicacao.evaluate((el) => el.scrollIntoView({ block: 'center' }));
  await shot('08-por-que-previsao.png');

  // Recebi: R$ 900 no Nubank → Hoje 1.675; previsões sem contar duas vezes.
  await tocar(page.getByRole('button', { name: 'Recebi Renda principal' }));
  const modalRecebi = page.getByRole('dialog', { name: 'Recebi o salário' });
  await modalRecebi.getByRole('radio', { name: 'Nubank' }).click();
  await expect(modalRecebi.getByRole('radio', { name: 'Nubank' })).toHaveAttribute('aria-checked', 'true');
  await shot('06-recebi.png');
  await modalRecebi.getByRole('button', { name: /Confirmar/ }).click();
  await confirmarToast('Recebido: Renda principal');
  await expect(hoje).toHaveText(brl('1.675,00'));
  await expect(seteDias).toHaveText(brl('1.555,00'));
  await expect(fimMes).toHaveText(brl('1.455,00'));
  await expect(page.getByRole('region', { name: 'Salário a receber' })).toHaveCount(0);
  // Renda do mês R$ 1.000 (900 + 100 extra), gasto R$ 25: o "Saiu" segue só com o gasto (sem transferência).
  await expect(page.getByRole('region', { name: 'Entrou e saiu no mês' })).toContainText(/Saiu\s*R\$\s25,00/);

  // Banco: transferência fora de transacoes; Recebi = receita Salário + recebimento.
  const estado = await (await fetch(`${MOCK_URL}/__mock/state`)).json();
  const uid = estado.users.find((u: { email: string }) => u.email === EMAIL).id;
  const meus = (t: string) => (estado.tables[t] ?? []).filter((r: { user_id: string }) => r.user_id === uid);
  expect(meus('transferencias')).toHaveLength(1);
  expect(meus('recebimentos_renda')).toHaveLength(1);
  expect(meus('transacoes').map((t: { categoria: string; valor: number }) => `${t.categoria}:${Number(t.valor)}`).sort())
    .toEqual(['Comida:25', 'Entrada extra:100', 'Salário:900']);

  // Gaveta → Bancos e carteira.
  await page.getByRole('button', { name: 'Abrir menu' }).click();
  await page.getByRole('dialog', { name: '✦ MeuDia' }).getByRole('link', { name: 'Bancos e carteira' }).click();
  await page.waitForURL(/\/financas\/carteiras$/);
  await expect(page.getByRole('heading', { name: 'Bancos e carteira', level: 1 })).toBeVisible();
  const lista = page.getByRole('listitem').filter({ hasText: 'Nubank' });
  await expect(lista).toContainText(/R\$\s1\.575,00/);
  await expect(page.getByRole('listitem').filter({ hasText: 'Caixa' })).toContainText(/R\$\s100,00/);
  await semScrollHorizontal();
  await shot('07-carteiras.png');

  expect(erros, 'erros na página ou respostas HTTP ≥ 400').toEqual([]);
});
