import crypto from 'node:crypto';
import path from 'node:path';
import type { Page } from '@playwright/test';
import { test, expect } from './mock-guard';
import { pastaEvidencias } from './evidencias';

/**
 * PR A1 (BRIEF-ICONES-ABAS + DIAG-CARD-ENTROU), iPhone 13 / WebKit contra o mock em memória do Supabase:
 * 5 abas, Início resumida sem rolar em 390×844, Gastos (filtros na URL) e Gastos › Análise com o cenário do print.
 * Relógio fixo em 18/10/2026 12:00 (SP) no navegador e no mock; dados por teste via POST /__mock/seed.
 */

const MOCK_URL = 'http://127.0.0.1:54329';
const AGORA = '2026-10-18T15:00:00.000Z';
const SENHA = 'senhaForte123';
const run = Date.now().toString(36);
const brl = (valor: string) => new RegExp(`^−?R\\$\\s${valor.replace('.', '\\.')}$`);

test.describe.configure({ mode: 'serial' });
const relogio = (now: string | null) =>
  fetch(`${MOCK_URL}/__mock/clock`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ now }) });
test.beforeAll(() => relogio(AGORA));
test.afterAll(() => relogio(null));

const coletarErros = (page: Page) => {
  const erros: string[] = [];
  page.on('pageerror', (err) => erros.push(`${err.name}: ${err.message}`));
  page.on('response', (res) => {
    if (res.status() >= 400) erros.push(`${res.request().method()} ${res.url()} → ${res.status()}`);
  });
  return erros;
};

/** Cadastro + onboarding (bancos opcionais); devolve o e-mail e os ids das carteiras pelo nome. */
async function cadastrar(page: Page, nome: string, bancos: [string, string][] = []) {
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
  for (const [i, [banco, centavos]] of bancos.entries()) {
    if (i > 0) await page.getByRole('button', { name: 'adicionar outro' }).click();
    await page.getByLabel(`Banco ou carteira ${i + 1}`).fill(banco);
    await page.getByLabel(`Quanto tem hoje (${i + 1})`).fill(centavos);
  }
  await page.getByRole('button', { name: 'Concluir' }).click();
  await page.waitForURL(/\/financas$/);
  // Espera a home assentar (o banner "Instalar MeuDia" aparece após 2s) antes de semear e recarregar:
  // um reload com as consultas da 1ª carga em voo vira "Fetch API cannot load" no WebKit. O banner fica aberto.
  await expect(page.getByText('Instalar MeuDia')).toBeVisible();
  const estado = await (await fetch(`${MOCK_URL}/__mock/state`)).json();
  const uid = estado.users.find((u: { email: string }) => u.email === email).id;
  const carteiras = Object.fromEntries(
    (estado.tables.carteiras ?? []).filter((c: { user_id: string }) => c.user_id === uid).map((c: { nome: string; id: string }) => [c.nome, c.id]),
  ) as Record<string, string>;
  return { email, carteiras };
}

async function semear(email: string, tables: Record<string, Record<string, unknown>[]>) {
  const res = await fetch(`${MOCK_URL}/__mock/seed`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, tables }) });
  expect(res.status, await res.clone().text()).toBe(200);
}

const despesa = (descricao: string, categoria: string, valor: number, data: string, carteira_id: string | null | undefined, banco: string | null, hora = '12') => ({
  tipo: 'despesa', descricao, categoria, valor, data, carteira_id, banco, created_at: `${data}T${hora}:00:00.000Z`,
});

test('5 abas, Início sem rolar em 390×844, Ver todos, Chat no header, Gastei e filtros de Gastos', async ({ page }) => {
  const erros = coletarErros(page);
  const EVIDENCIAS = pastaEvidencias('icones-abas');
  // Dados típicos: 2 bancos, 2 contas, 3 gastos (e 1 em setembro), salário já recebido.
  const { email, carteiras } = await cadastrar(page, 'Lia Abas', [['Nubank', '98000'], ['Caixa', '30000']]);
  const renda = crypto.randomUUID();
  const salario = crypto.randomUUID();
  await semear(email, {
    rendas: [{ id: renda, descricao: 'Salário', valor: 2350, dia_recebimento: 5, created_at: '2026-09-01T12:00:00.000Z' }],
    transacoes: [
      { id: salario, tipo: 'receita', descricao: 'Salário', categoria: 'Salário', valor: 2350, data: '2026-10-05', carteira_id: carteiras.Nubank, banco: 'Nubank' },
      despesa('Mercado do bairro', 'Mercado', 86.4, '2026-10-18', carteiras.Nubank, 'Nubank', '14'),
      despesa('Almoço', 'Comida', 32.9, '2026-10-18', carteiras.Caixa, 'Caixa', '13'),
      despesa('Esmaltação', 'Estética', 45, '2026-10-17', carteiras.Nubank, 'Nubank'),
      despesa('Farmácia', 'Saúde', 40, '2026-09-20', null, null),
    ],
    recebimentos_renda: [{ renda_id: renda, competencia: '2026-10', recebido_em: '2026-10-05', transacao_id: salario }],
    contas_pagar: [
      { descricao: 'Internet', categoria: 'Internet', valor: 110, recorrencia: 'mensal', dia_vencimento: 19 },
      { descricao: 'Luz', categoria: 'Luz', valor: 150, recorrencia: 'mensal', dia_vencimento: 25 },
    ],
  });

  // ── Início sem rolar em 390×844 ────────────────────────────────────────────
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  const nav = page.getByRole('navigation', { name: 'Navegação principal' });
  const ultimos = page.getByRole('region', { name: 'Últimos gastos' });
  await expect(ultimos.getByRole('listitem')).toHaveCount(3);
  await expect(page.getByTestId('saldo-hoje-valor')).toHaveText(brl('1.280,00'));
  await expect(page.getByRole('region', { name: 'Contas a vencer' }).locator('[data-conta]')).toHaveCount(2);
  await expect(page.getByText('Sobra do mês', { exact: true })).toHaveCount(1);
  const caixaNav = (await nav.boundingBox())!;

  // ── Banner "Instalar MeuDia" visível (iOS, após 2s) não cobre o "Gastei" (revisão Codex 2) ──
  // A página reserva o espaço do banner: rolando até o fim, o Gastei fica acima dele, e ele segue acima da barra.
  const banner = page.getByText('Instalar MeuDia').locator('xpath=ancestor::div[contains(@class,"fixed")][1]');
  await expect(banner).toBeVisible();
  const gastei = ultimos.getByRole('button', { name: 'Gastei' });
  const caixaBanner = (await banner.boundingBox())!;
  expect(caixaBanner.y + caixaBanner.height, 'banner cobre a barra').toBeLessThanOrEqual(caixaNav.y);
  await expect.poll(async () => {
    await page.evaluate(() => window.scrollTo(0, document.scrollingElement!.scrollHeight));
    const g = (await gastei.boundingBox())!;
    return g.y + g.height <= (await banner.boundingBox())!.y;
  }, { message: 'banner cobre o Gastei rolando até o fim' }).toBe(true);
  await page.screenshot({ path: path.join(EVIDENCIAS, '13-inicio-banner-gastei.png'), animations: 'disabled' });
  await gastei.click({ timeout: 5_000 });
  await expect(page.getByRole('dialog', { name: 'Gastei' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  // Fechado o banner, a reserva some e a Início volta a caber sem rolar.
  await banner.getByRole('button', { name: 'Fechar' }).click();
  await expect(banner).toBeHidden();
  await page.evaluate(() => window.scrollTo(0, 0));

  const caixaUltimo = (await ultimos.boundingBox())!;
  expect(caixaUltimo.y + caixaUltimo.height, 'último bloco atrás da barra').toBeLessThanOrEqual(caixaNav.y);
  const { scroll, altura } = await page.evaluate(() => ({ scroll: document.scrollingElement!.scrollHeight, altura: window.innerHeight }));
  expect(scroll, 'Início rola em 390×844').toBeLessThanOrEqual(altura);
  await page.screenshot({ path: path.join(EVIDENCIAS, '10-inicio-resumida.png'), animations: 'disabled' });

  // ── Barra: 5 abas, ≥ 44px, safe-area, aria-current ─────────────────────────
  expect(await nav.getAttribute('style')).toContain('safe-area-inset-bottom');
  expect(caixaNav.y + caixaNav.height).toBeLessThanOrEqual(844);
  const abas = [
    { nome: 'Início', url: /\/financas$/, titulo: 'Início' },
    { nome: 'Gastos', url: /\/financas\/gastos$/, titulo: 'Gastos' },
    { nome: 'Metas', url: /\/financas\/metas$/, titulo: /Metas/ },
    { nome: 'Bancos', url: /\/financas\/carteiras$/, titulo: 'Bancos e carteira' },
    { nome: 'Config', url: /\/configuracoes$/, titulo: /Configura/ },
  ];
  await expect(nav.getByRole('link')).toHaveText(abas.map((a) => a.nome));
  for (const aba of [...abas.slice(1), abas[0]!]) {
    const link = nav.getByRole('link', { name: aba.nome });
    await link.click();
    await page.waitForURL(aba.url);
    await expect(page.getByRole('heading', { level: 1 }).first()).toHaveText(aba.titulo);
    await expect(link).toHaveAttribute('aria-current', 'page');
    await expect(nav.locator('[aria-current="page"]')).toHaveCount(1);
    const caixa = (await link.boundingBox())!;
    expect(caixa.height, `${aba.nome} < 44px`).toBeGreaterThanOrEqual(44);
    expect(caixa.width, `${aba.nome} < 44px`).toBeGreaterThanOrEqual(44);
  }
  // Notificações (lembretes) agora ficam em Config: verificado na passagem acima.

  // ── Chat pelo ícone do header ──────────────────────────────────────────────
  const chat = page.getByRole('button', { name: 'Abrir assistente' });
  const caixaChat = (await chat.boundingBox())!;
  expect(caixaChat.height).toBeGreaterThanOrEqual(44);
  await chat.click();
  const painel = page.getByRole('dialog', { name: 'Agente MeuDia' });
  await expect(painel).toBeVisible();
  await painel.getByRole('button', { name: 'Fechar assistente' }).click();
  await expect(painel).toBeHidden();

  // ── Gastei (Início) abre o lançamento; Voltar leva ao Entrou dinheiro ──────
  await ultimos.getByRole('button', { name: 'Gastei' }).click();
  const folha = page.getByRole('dialog', { name: 'Gastei' });
  await expect(folha).toBeVisible();
  await folha.getByRole('button', { name: 'Voltar' }).click();
  await expect(page.getByRole('dialog', { name: 'O que aconteceu?' }).getByRole('button', { name: /Entrou dinheiro/ })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);

  // ── "Ver todos os gastos" → Gastos ─────────────────────────────────────────
  await page.getByRole('link', { name: /Ver todos os gastos/ }).click();
  await page.waitForURL(/\/financas\/gastos$/);
  await expect(nav.getByRole('link', { name: 'Gastos' })).toHaveAttribute('aria-current', 'page');

  // ── Filtros (URL), lista e total ───────────────────────────────────────────
  const total = page.getByTestId('total-gastos');
  const lista = page.getByRole('region', { name: 'Últimas despesas' });
  await expect(total).toHaveText(brl('164,30'));
  await expect(lista.getByRole('listitem').first()).toContainText('Mercado do bairro');
  await expect(lista.getByRole('listitem').first()).toContainText(/Mercado · 18\/10 · Nubank/);
  // Linha "categoria · data · banco" inteira em 390px: o banco aparece e nada é cortado com "…".
  const meta = lista.getByRole('listitem').first().locator('[data-meta]');
  await expect(meta).toBeVisible();
  await expect(meta).toContainText('Nubank');
  const corte = await meta.evaluate((el) => ({ scroll: el.scrollWidth, cliente: el.clientWidth }));
  expect(corte.scroll, 'linha do banco truncada').toBeLessThanOrEqual(corte.cliente);
  // Select de categoria no padrão escuro do app (nada de fundo branco nativo do iOS).
  // O fundo computado pode ser escuro e o WebKit ainda pintar o controle nativo branco: exige appearance none.
  const select = await page.getByLabel('Categoria').evaluate((el) => {
    const c = getComputedStyle(el) as CSSStyleDeclaration & { webkitAppearance?: string };
    return { aparencia: c.appearance || c.webkitAppearance, cor: c.color, altura: el.getBoundingClientRect().height };
  });
  expect(select.aparencia, 'select com aparência nativa (fundo branco no iOS)').toBe('none');
  expect(select.altura).toBeGreaterThanOrEqual(44);
  const [cr] = (select.cor.match(/\d+(\.\d+)?/g) ?? ['0']).map(Number);
  expect(cr!, `texto do select escuro: ${select.cor}`).toBeGreaterThan(180);
  const fundo = await page.getByLabel('Categoria').evaluate((el) => getComputedStyle(el).backgroundColor);
  const [r, g, b] = (fundo.match(/\d+(\.\d+)?/g) ?? ['255', '255', '255']).map(Number);
  expect(Math.max(r!, g!, b!), `fundo do select claro: ${fundo}`).toBeLessThan(80);
  // Ações da linha com alvo de toque ≥ 44×44 (revisão Codex 3).
  for (const nome of ['Editar lançamento Mercado do bairro', 'Excluir lançamento Mercado do bairro']) {
    const caixa = (await lista.getByRole('button', { name: nome }).boundingBox())!;
    expect(caixa.width, `${nome}: largura`).toBeGreaterThanOrEqual(44);
    expect(caixa.height, `${nome}: altura`).toBeGreaterThanOrEqual(44);
  }
  await page.screenshot({ path: path.join(EVIDENCIAS, '11-gastos-ultimas-despesas.png'), animations: 'disabled' });
  await page.getByLabel('Categoria').selectOption('Mercado');
  await page.waitForURL(/\/financas\/gastos\?categoria=Mercado$/);
  await expect(total).toHaveText(brl('86,40'));
  await expect(lista.getByRole('listitem')).toHaveCount(1);
  await expect(nav.getByRole('link', { name: 'Gastos' })).toHaveAttribute('aria-current', 'page');
  await page.getByLabel('Categoria').selectOption('');
  await page.getByRole('button', { name: 'Mês anterior' }).click();
  await page.waitForURL(/\/financas\/gastos\?mes=2026-09$/);
  await expect(total).toHaveText(brl('40,00'));
  await expect(lista.getByRole('listitem')).toHaveCount(1);
  await expect(lista).toContainText(/Saúde · 20\/09 · Sem banco/);

  expect(erros, 'erros na página ou respostas HTTP ≥ 400').toEqual([]);
});

test('Gastos › Análise com o cenário do print (DIAG-CARD-ENTROU): Salário × Extras, sem comparação falsa', async ({ page }) => {
  const erros = coletarErros(page);
  const { email } = await cadastrar(page, 'Rita Print');
  await semear(email, {
    rendas: [{ descricao: 'Salário', valor: 943, dia_recebimento: 5 }],
    transacoes: [
      { tipo: 'receita', descricao: 'Pix', categoria: 'Entrada extra', valor: 150, data: '2026-10-10' },
      despesa('Mercado', 'Mercado', 300, '2026-10-12', null, null),
      despesa('Uber', 'Transporte', 274, '2026-10-15', null, null),
    ],
    contas_pagar: [
      { descricao: 'Aluguel', categoria: 'Aluguel', valor: 500, recorrencia: 'mensal', dia_vencimento: 5 },
      { descricao: 'Internet', categoria: 'Internet', valor: 344, recorrencia: 'mensal', dia_vencimento: 25 },
    ],
  });
  await page.goto('/financas/gastos?aba=analise');
  await expect(page.getByRole('tab', { name: 'Análise' })).toHaveAttribute('aria-selected', 'true');
  const entrou = page.getByRole('region', { name: 'Entrou' });
  await expect(entrou).toContainText(/Salário\s*recebido R\$\s0,00 de R\$\s943,00/);
  await expect(entrou).toContainText(/Extras\s*R\$\s150,00/);
  const saiu = page.getByRole('region', { name: 'Saiu' });
  await expect(saiu).toContainText(/Saiu\s*R\$\s574,00/);
  await expect(saiu).toContainText(/Contas do mês\s*R\$\s844,00 \(pagas R\$\s0,00, faltam R\$\s844,00\)/);
  await expect(saiu).toContainText('Primeiro mês no app');
  await expect(page.getByText(/a mais que em setembro/)).toHaveCount(0);
  await expect(page.getByText(/Sobra do mês|Prevista/)).toHaveCount(0);
  await expect(page.getByText(/Usou\s*53%\s*da renda do mês \(salário \+ extras\)/)).toBeVisible();
  await expect(page.getByText(/Pagas em dia\s*—/)).toBeVisible();
  await page.screenshot({ path: path.join(pastaEvidencias('icones-abas'), '12-gastos-analise-print.png'), fullPage: true, animations: 'disabled' });
  expect(erros, 'erros na página ou respostas HTTP ≥ 400').toEqual([]);
});
