import path from 'node:path';
import type { Locator, Page } from '@playwright/test';
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
  // 014: a Início mostra o Cofrinho (dinheiro guardado), que NÃO muda com gasto, entrada, transferência nem Recebi.
  const cofrinho = page.getByTestId('linha-cofrinho-valor');
  const fimMes = page.getByTestId('previsao-fim-mes-valor');
  const linhaResumo = (id: string) => page.getByTestId(id);
  const semScrollHorizontal = async () => {
    const { scroll, largura } = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, largura: window.innerWidth }));
    expect(scroll, 'scroll horizontal em 390px').toBeLessThanOrEqual(largura);
  };
  // O "+" saiu da barra: "Gastei" na Início abre a folha no gasto; "Voltar" leva a Entrou dinheiro/Transferir.
  const abrirAcao = async (acao: RegExp) => {
    await tocar(page.getByRole('region', { name: 'Últimos lançamentos' }).getByRole('button', { name: 'Gastei' }));
    if (acao.test('Gastei')) return page.getByRole('dialog');
    await page.getByRole('dialog', { name: 'Gastei' }).getByRole('button', { name: 'Voltar' }).click();
    const menu = page.getByRole('dialog', { name: 'O que aconteceu?' });
    await expect(menu).toBeVisible();
    await menu.getByRole('button', { name: acao }).click();
    return page.getByRole('dialog');
  };
  const irPara = async (aba: 'Início' | 'Gastos', url: RegExp) => {
    // Design v2: Gastos saiu da barra e fica no menu "Mais".
    if (aba === 'Gastos') {
      await page.getByRole('button', { name: 'Abrir menu' }).click();
      await page.getByRole('dialog', { name: '✦ MeuDia' }).getByRole('link', { name: 'Gastos' }).click();
    } else {
      await bottomNav.getByRole('link', { name: aba }).click();
    }
    await page.waitForURL(url);
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

  // 1. Nubank 650 + Caixa 50: o Cofrinho começa com o que havia nos bancos (R$ 700).
  await expect(cofrinho).toHaveText(brl('700,00'));

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
  await expect(cofrinho).toHaveText(brl('700,00'));

  // 3. Contas pendentes: luz R$ 120 (20/10) e internet R$ 100 (25/10). Contas fica no menu lateral.
  await page.getByRole('button', { name: 'Abrir menu' }).click();
  await page.getByRole('dialog', { name: '✦ MeuDia' }).getByRole('link', { name: 'Contas' }).click();
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
  await expect(cofrinho).toHaveText(brl('700,00'));
  // Deve sobrar = renda 100 (entrada extra; sem renda fixa) − contas fixas 220 − gastos 0 = −120. Sem o card "Em 7 dias".
  await expect(page.getByText('Em 7 dias você terá')).toHaveCount(0);
  await expect(page.getByRole('region', { name: 'A conta de outubro' })).toBeVisible();
  await expect(linhaResumo('resumo-renda')).toHaveText(brl('100,00'));
  await expect(linhaResumo('resumo-contas-fixas')).toHaveText(/^− R\$\s220,00$/);
  await expect(linhaResumo('resumo-gastos')).toHaveText(/^− R\$\s0,00$/);
  await expect(fimMes).toHaveText(/^−R\$\s120,00$/);
  // A linha do Cofrinho abre Bancos, com o cartão do Cofrinho e o total dos bancos separados.
  await tocar(page.getByTestId('linha-cofrinho'));
  await page.waitForURL(/\/financas\/carteiras$/);
  await expect(page.getByTestId('cofrinho-valor')).toHaveText(brl('700,00'));
  await expect(page.getByTestId('total-bancos')).toContainText(/Total nos bancos: R\$\s800,00/);
  await bottomNav.getByRole('link', { name: 'Início' }).click();
  await page.waitForURL(/\/financas$/);

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
  await expect(cofrinho).toHaveText(brl('700,00'));
  // Transferência não é gasto: sem gasto no mês, a Início nem mostra "Para onde foi".
  await expect(page.getByRole('region', { name: 'Últimos lançamentos' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Para onde foi' })).toHaveCount(0);

  // 5. Gastei R$ 25 em Comida no Nubank → o Cofrinho NÃO cai (700); deve sobrar −145.
  folha = await abrirAcao(/Gastei/);
  // Regressão: a folha reabria com o form da última ação (Transferir) por um quadro e apagava o valor (corrigido 19/11).
  await folha.getByLabel('Valor').fill('2500');
  await tocar(folha.getByRole('radio', { name: 'Comida' }));
  const nubankGasto = folha.getByRole('radiogroup', { name: 'Saiu de' }).getByRole('radio', { name: 'Nubank' });
  await nubankGasto.click();
  await expect(nubankGasto).toHaveAttribute('aria-checked', 'true');
  await expect(folha.getByRole('radio', { name: 'Comida' })).toHaveAttribute('aria-checked', 'true');
  await expect(folha.getByLabel('Valor')).toHaveValue(/25,00/);
  await shot('03-gastei.png');
  await folha.getByRole('button', { name: 'Salvar gasto' }).click();
  await confirmarToast('Gasto salvo');
  await expect(cofrinho).toHaveText(brl('700,00'));
  await expect(page.getByRole('region', { name: 'Últimos lançamentos' })).toContainText(/R\$\s25,00/);
  await expect(linhaResumo('resumo-gastos')).toHaveText(/^− R\$\s25,00$/);
  await expect(fimMes).toHaveText(/^−R\$\s145,00$/);

  // 6. Só agora a renda: R$ 900 dia 5 (sem Recebi) entra como previsão: deve sobrar 1.000 − 220 − 25 = 755.
  await tocar(page.getByRole('button', { name: 'Cadastrar minha renda' }));
  const modalRenda = page.getByRole('dialog', { name: 'Sua renda do mês' });
  await modalRenda.getByLabel('Valor').fill('90000');
  await modalRenda.getByLabel('Dia que recebe (opcional)').fill('5');
  await modalRenda.getByRole('button', { name: 'Salvar' }).click();
  await confirmarToast('Renda salva');
  await expect(cofrinho).toHaveText(brl('700,00'));
  await expect(fimMes).toHaveText(brl('755,00'));
  await expect(page.getByTestId('renda-previsao')).toBeVisible();
  await semScrollHorizontal();
  await shot('02-home-dashboard.png');
  // Viewport (o que a usuária vê no iPhone): topo da home e rolada até os gráficos.
  await page.evaluate(() => window.scrollTo(0, 0));
  await shot('02-home-dashboard-viewport.png', false);

  // Contas fixas (no cartão "A conta" do maço): a lista mostra cada conta com "a pagar" (pagas ou não, já contam na sobra).
  await tocar(page.getByRole('button', { name: 'Próximo cartão: A conta' }));
  await expect(page.getByTestId('cartao-pagina-conta')).toHaveClass(/cartao-frente/);
  await tocar(page.getByRole('button', { name: /Contas fixas/ }));
  const listaContas = page.getByRole('list', { name: 'Contas fixas de outubro' });
  await expect(listaContas.getByRole('listitem')).toHaveCount(2);
  await expect(listaContas.getByRole('listitem').first()).toContainText(/Luz.*vence 20\/10.*a pagar/);
  await expect(listaContas.getByRole('listitem').last()).toContainText(/Internet.*vence 25\/10.*a pagar/);
  await listaContas.evaluate((el) => el.scrollIntoView({ block: 'center' }));
  await shot('08-contas-fixas.png');

  // Recebi: R$ 900 no Nubank → a renda deixa de ser previsão; a sobra não muda e o Cofrinho também não.
  await tocar(page.getByRole('button', { name: 'Recebi Renda principal' }));
  const modalRecebi = page.getByRole('dialog', { name: 'Recebi o salário' });
  await modalRecebi.getByRole('radio', { name: 'Nubank' }).click();
  await expect(modalRecebi.getByRole('radio', { name: 'Nubank' })).toHaveAttribute('aria-checked', 'true');
  await shot('06-recebi.png');
  await modalRecebi.getByRole('button', { name: /Confirmar/ }).click();
  await confirmarToast('Recebido: Renda principal');
  await expect(cofrinho).toHaveText(brl('700,00'));
  await expect(fimMes).toHaveText(brl('755,00'));
  await expect(page.getByTestId('renda-previsao')).toHaveCount(0);
  await expect(page.getByText('A receber: Renda principal', { exact: false })).toHaveCount(0);
  // Gastos › Análise: salário recebido 900 de 900 + extra 100; o "Saiu" segue só com o gasto (sem transferência).
  await irPara('Gastos', /\/financas\/gastos$/);
  await expect(page.getByRole('listitem').filter({ hasText: 'Comida' })).toContainText(/R\$\s25,00/);
  await page.getByRole('tab', { name: 'Análise' }).click();
  await page.waitForURL(/aba=analise/);
  await expect(page.getByRole('region', { name: 'Gastos do mês por categoria' })).toContainText(/Comida\s*R\$\s25,00/);
  await expect(page.getByRole('region', { name: 'Entrou' })).toContainText(/Salário\s*recebido R\$\s900,00 de R\$\s900,00/);
  await expect(page.getByRole('region', { name: 'Entrou' })).toContainText(/Extras\s*R\$\s100,00/);
  await expect(page.getByRole('region', { name: 'Saiu' })).toContainText(/Saiu\s*R\$\s25,00/);
  await page.getByRole('region', { name: 'Gastos do mês por categoria' }).evaluate((el) => el.scrollIntoView({ block: 'start' }));
  await page.evaluate(() => window.scrollBy(0, -72)); // folga para o header fixo não cobrir o título do card
  await shot('02b-analise-graficos-viewport.png', false);

  // Banco: transferência fora de transacoes; Recebi = receita Salário + recebimento.
  const estado = await (await fetch(`${MOCK_URL}/__mock/state`)).json();
  const uid = estado.users.find((u: { email: string }) => u.email === EMAIL).id;
  const meus = (t: string) => (estado.tables[t] ?? []).filter((r: { user_id: string }) => r.user_id === uid);
  expect(meus('transferencias')).toHaveLength(1);
  expect(meus('recebimentos_renda')).toHaveLength(1);
  expect(meus('transacoes').map((t: { categoria: string; valor: number }) => `${t.categoria}:${Number(t.valor)}`).sort())
    .toEqual(['Comida:25', 'Entrada extra:100', 'Salário:900']);

  // A receita vinculada não edita; excluir pede confirmação e desfaz o Recebi (a renda volta a ficar a receber).
  await expect(page.getByRole('button', { name: 'Editar lançamento Renda principal' })).toHaveCount(0);
  await tocar(page.getByRole('button', { name: 'Excluir lançamento Renda principal' }));
  const confirmar = page.getByRole('dialog', { name: 'Excluir lançamento' });
  await expect(confirmar).toContainText('Excluir? Isso não pode ser desfeito. Ele veio do "Recebi": o lançamento sai e a renda volta a ficar a receber.');
  await confirmar.getByRole('button', { name: 'Excluir' }).click();
  await confirmarToast('Lançamento excluído. A renda voltou a ficar a receber.');
  await irPara('Início', /\/financas$/);
  await expect(cofrinho).toHaveText(brl('700,00'));
  await expect(page.getByTestId('renda-previsao')).toBeVisible();
  await tocar(page.getByRole('button', { name: 'Recebi Renda principal' }));
  await modalRecebi.getByRole('radio', { name: 'Nubank' }).click();
  await modalRecebi.getByRole('button', { name: /Confirmar/ }).click();
  await confirmarToast('Recebido: Renda principal');
  await expect(cofrinho).toHaveText(brl('700,00'));

  // Gaveta → Bancos e carteira.
  await page.getByRole('button', { name: 'Abrir menu' }).click();
  await page.getByRole('dialog', { name: '✦ MeuDia' }).getByRole('link', { name: 'Bancos e carteira' }).click();
  await page.waitForURL(/\/financas\/carteiras$/);
  await expect(page.getByRole('heading', { name: 'Bancos e carteira', level: 1 })).toBeVisible();
  // Só os cartões de banco (a lista de transferências também tem "Caixa → Nubank"): o cartão é o item com o botão "Excluir <banco>".
  const cartaoBanco = (nome: string) =>
    page.getByRole('listitem').filter({ has: page.getByRole('button', { name: `Excluir ${nome}`, exact: true }) });
  const lista = cartaoBanco('Nubank');
  await expect(lista).toContainText(/R\$\s1\.575,00/);
  await expect(cartaoBanco('Caixa')).toContainText(/R\$\s100,00/);
  await expect(page.getByTestId('total-bancos')).toContainText(/Total nos bancos: R\$\s1\.675,00/);
  await expect(page.getByTestId('cofrinho-valor')).toHaveText(brl('700,00'));
  await semScrollHorizontal();
  await shot('07-carteiras.png');

  await tocar(page.getByRole('button', { name: 'Corrigir saldo de Nubank' }));
  const correcao = page.getByRole('dialog', { name: 'Corrigir saldo', exact: true });
  await correcao.getByLabel('Quanto o banco mostra agora?').fill('150000');
  await correcao.getByRole('button', { name: 'Corrigir', exact: true }).click();
  await confirmarToast('Saldo corrigido');
  await expect(lista).toContainText(/R\$\s1\.500,00/);
  const corrigido = await (await fetch(`${MOCK_URL}/__mock/state`)).json();
  const ajustes = corrigido.tables.transacoes.filter((t: { user_id: string; ajuste: boolean }) => t.user_id === uid && t.ajuste);
  expect(ajustes).toHaveLength(1);
  expect(ajustes[0]).toMatchObject({ valor: 75, tipo: 'despesa', chave_ajuste: expect.stringMatching(/^[0-9a-f-]{36}$/) });
  await expect(page.getByTestId('cofrinho-valor')).toHaveText(brl('700,00'));

  expect(erros, 'erros na página ou respostas HTTP ≥ 400').toEqual([]);
});

/** Cadastro com 1 banco (R$ 235 em 17/10), Salário 2.200 no dia `diaSalario` e Internet 110 no dia 20. */
async function cadastrarCenario(page: Page, nome: string, diaSalario: number) {
  const tocar = async (alvo: Locator) => {
    await alvo.evaluate((el) => el.scrollIntoView({ block: 'center' }));
    await alvo.click();
  };
  const bottomNav = page.getByRole('navigation', { name: 'Navegação principal' });
  await page.goto('/registro');
  await page.getByLabel('Nome').fill(nome);
  await page.getByLabel('Email').fill(`${nome.toLowerCase().replace(/\s/g, '.')}.${run}@example.test`);
  await page.getByLabel('Senha', { exact: true }).fill(SENHA);
  await page.getByLabel('Confirmar senha').fill(SENHA);
  await page.getByRole('button', { name: 'Criar conta' }).click();
  await page.waitForURL(/\/onboarding/);
  await page.getByRole('button', { name: 'Continuar' }).click();
  await page.getByLabel('Banco ou carteira 1').fill('Nubank');
  await page.getByLabel('Quanto tem hoje (1)').fill('23500');
  await page.getByRole('button', { name: 'Concluir' }).click();
  await page.waitForURL(/\/financas$/);
  const banner = page.getByText('Instalar MeuDia').locator('xpath=ancestor::div[contains(@class,"fixed")][1]');
  await expect(banner).toBeVisible();
  await banner.getByRole('button', { name: 'Fechar' }).click();

  await tocar(page.getByRole('button', { name: 'Cadastrar minha renda' }));
  const modalRenda = page.getByRole('dialog', { name: 'Sua renda do mês' });
  await modalRenda.getByLabel('Valor').fill('220000');
  await modalRenda.getByLabel('Dia que recebe (opcional)').fill(String(diaSalario));
  await modalRenda.getByRole('button', { name: 'Salvar' }).click();
  await expect(modalRenda).toBeHidden();

  await page.getByRole('button', { name: 'Abrir menu' }).click();
  await page.getByRole('dialog', { name: '✦ MeuDia' }).getByRole('link', { name: 'Contas' }).click();
  await page.waitForURL(/\/financas\/contas$/);
  await tocar(page.getByRole('button', { name: 'Nova conta' }).first());
  const modal = page.getByRole('dialog', { name: 'Nova conta' });
  await modal.getByLabel('Nome').fill('Internet');
  await modal.getByLabel('Valor (R$)').fill('110');
  await modal.getByLabel('Dia do vencimento').fill('20');
  await tocar(modal.getByRole('radio', { name: 'Internet' }));
  await modal.getByRole('button', { name: 'Salvar' }).click();
  await expect(modal).toBeHidden();
  await bottomNav.getByRole('link', { name: 'Início' }).click();
  await page.waitForURL(/\/financas$/);
  return { tocar };
}

const coletarErros = (page: Page) => {
  const erros: string[] = [];
  page.on('pageerror', (err) => erros.push(`${err.name}: ${err.message}`));
  page.on('response', (res) => {
    if (res.status() >= 400) erros.push(`${res.request().method()} ${res.url()} → ${res.status()}`);
  });
  return erros;
};

/** Exemplo A do Estevam: salário 2.200 dia 1 sem Recebi, Internet 110 dia 20 → "Deve sobrar" 2.090; sem "Em 7 dias". */
test('previsão A: fim do mês = 2.090 e o card "Em 7 dias" não aparece', async ({ page }) => {
  await page.clock.setFixedTime(new Date(AGORA));
  const erros = coletarErros(page);
  await cadastrarCenario(page, 'Caio A', 1);
  await expect(page.getByTestId('linha-cofrinho-valor')).toHaveText(brl('235,00'));
  await expect(page.getByTestId('previsao-fim-mes-valor')).toHaveText(brl('2.090,00'));
  // A conta explícita: 2.200 (previsão) − 110 − 0 = 2.090.
  await expect(page.getByTestId('resumo-renda')).toHaveText(brl('2.200,00'));
  await expect(page.getByTestId('renda-previsao')).toBeVisible();
  await expect(page.getByTestId('resumo-contas-fixas')).toHaveText(/^− R\$\s110,00$/);
  await expect(page.getByTestId('resumo-gastos')).toHaveText(/^− R\$\s0,00$/);
  await expect(page.getByTestId('resumo-comprometida')).toHaveText(/^até 31\/10 · 5% da renda já tem destino$/);
  // A linha do Cofrinho abre Bancos.
  await page.getByTestId('linha-cofrinho').click();
  await page.waitForURL(/\/financas\/carteiras$/);
  await expect(page.getByTestId('cofrinho-valor')).toHaveText(brl('235,00'));
  await page.goBack();
  await page.waitForURL(/\/financas$/);
  await expect(page.getByText('Em 7 dias você terá')).toHaveCount(0);
  expect(erros, 'erros na página ou respostas HTTP ≥ 400').toEqual([]);
});

/** Exemplos B e C: Recebi e Paguei não mudam o "No fim do mês sobra". */
test('previsão B/C: fim do mês 2.090 continua igual depois de Recebi e de Paguei', async ({ page }) => {
  await page.clock.setFixedTime(new Date(AGORA));
  const erros = coletarErros(page);
  const { tocar } = await cadastrarCenario(page, 'Caio B', 25);
  const cofrinho = page.getByTestId('linha-cofrinho-valor');
  const fimMes = page.getByTestId('previsao-fim-mes-valor');
  const confirmarToast = async (texto: string) => {
    const alerta = page.getByRole('alert').filter({ hasText: texto });
    await expect(alerta).toBeVisible();
    await alerta.getByRole('button', { name: 'Fechar notificação' }).click();
    await expect(alerta).toBeHidden();
  };

  await expect(cofrinho).toHaveText(brl('235,00'));
  await expect(fimMes).toHaveText(brl('2.090,00'));

  await tocar(page.getByRole('button', { name: 'Recebi Renda principal' }));
  const modalRecebi = page.getByRole('dialog', { name: 'Recebi o salário' });
  await modalRecebi.getByRole('button', { name: /Confirmar/ }).click();
  await confirmarToast('Recebido: Renda principal');
  await expect(cofrinho).toHaveText(brl('235,00'));
  await expect(fimMes).toHaveText(brl('2.090,00'));

  await tocar(page.getByRole('button', { name: 'Paguei Internet' }));
  await confirmarToast('"Internet" marcada como paga.');
  // "Paguei" não conta duas vezes: a despesa dele é a conta fixa (agora "pago"), não um gasto do mês.
  await expect(cofrinho).toHaveText(brl('235,00'));
  await expect(fimMes).toHaveText(brl('2.090,00'));
  await expect(page.getByTestId('resumo-gastos')).toHaveText(/^− R\$\s0,00$/);
  await expect(page.getByTestId('resumo-contas-fixas')).toHaveText(/^− R\$\s110,00$/);
  // O status das contas fixas fica na lista, aberta pelo cartão "A conta" do maço.
  await tocar(page.getByRole('button', { name: 'Próximo cartão: A conta' }));
  await expect(page.getByTestId('cartao-pagina-conta')).toHaveClass(/cartao-frente/);
  await tocar(page.getByRole('button', { name: /Contas fixas/ }));
  await expect(page.getByText('1 paga · 0 a pagar', { exact: false })).toBeVisible();
  expect(erros, 'erros na página ou respostas HTTP ≥ 400').toEqual([]);
});
