import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { Page } from '@playwright/test';
import { test, expect } from './mock-guard';
import { pastaEvidencias } from './evidencias';

/**
 * PR A2 (BRIEF-PR-A2), iPhone 13 / WebKit contra o mock em memória do Supabase:
 * Config reorganizada (Perfil, Categorias, Notificações, Privacidade, Sair, Zona de perigo), "Baixar meus dados"
 * (CSV só com os dados de quem está logado), Orçamento sem "Sobra prevista" e ícones novos (Comida, Unha, Sobrancelha).
 * Relógio do navegador e do mock em 18/10/2026 12:00 (SP); o servidor Next usa o relógio real (nome do arquivo).
 */

const MOCK_URL = 'http://127.0.0.1:54329';
const AGORA = '2026-10-18T15:00:00.000Z';
const SENHA = 'senhaForte123';
const run = Date.now().toString(36);

test.describe.configure({ mode: 'serial' });
const relogio = (now: string | null) =>
  fetch(`${MOCK_URL}/__mock/clock`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ now }) });
test.beforeAll(() => relogio(AGORA));
test.afterAll(() => relogio(null));

const estadoMock = async () => (await fetch(`${MOCK_URL}/__mock/state`)).json();

async function semear(email: string, tables: Record<string, Record<string, unknown>[]>) {
  const res = await fetch(`${MOCK_URL}/__mock/seed`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, tables }) });
  expect(res.status, await res.clone().text()).toBe(200);
}

/** Usuário B direto pela API de Auth do mock (signup com autoconfirm), sem passar pelo navegador do A. */
async function cadastrarOutro(nome: string) {
  const email = `${nome.toLowerCase().replace(/\s/g, '.')}.${run}@example.test`;
  const res = await fetch(`${MOCK_URL}/auth/v1/signup`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password: SENHA, data: { nome } }),
  });
  expect(res.status).toBe(200);
  const { user } = await res.json();
  return { email, uid: user.id as string };
}

/** Cadastro + onboarding com um banco; devolve e-mail, uid e o id da carteira. */
async function cadastrar(page: Page, nome: string, banco: string) {
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
  await page.getByLabel('Banco ou carteira 1').fill(banco);
  await page.getByLabel('Quanto tem hoje (1)').fill('100000');
  await page.getByRole('button', { name: 'Concluir' }).click();
  await page.waitForURL(/\/financas$/);
  // Espera a home assentar (o banner "Instalar MeuDia" aparece após 2s) e fecha o banner para os prints.
  const banner = page.getByText('Instalar MeuDia').locator('xpath=ancestor::div[contains(@class,"fixed")][1]');
  await expect(banner).toBeVisible();
  await banner.getByRole('button', { name: 'Fechar' }).click();
  await expect(banner).toBeHidden();
  const estado = await estadoMock();
  const uid = estado.users.find((u: { email: string }) => u.email === email).id as string;
  const carteira = estado.tables.carteiras.find((c: { user_id: string; nome: string }) => c.user_id === uid && c.nome === banco).id as string;
  return { email, uid, carteira };
}

const despesa = (descricao: string, categoria: string, valor: number, data: string, carteira_id: string | null, banco: string | null, hora: string) => ({
  tipo: 'despesa', descricao, categoria, valor, data, carteira_id, banco, created_at: `${data}T${hora}:00:00.000Z`,
});

/** Dia de hoje em São Paulo pelo relógio real (o do servidor Next que monta o nome do arquivo). */
const hojeSPReal = () =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());

test('Config: seções, nome, dia do salário, Categorias → Orçamento, Baixar meus dados (só do usuário), ícones novos e Sair', async ({ page }) => {
  const EVIDENCIAS = pastaEvidencias('pr-a2-config');
  await page.setViewportSize({ width: 390, height: 844 });

  // ── Usuário B (outro): dados que NUNCA podem aparecer no CSV do A ──────────
  const bruno = await cadastrarOutro('Bruno Outro');
  const carteiraB = crypto.randomUUID();
  await semear(bruno.email, {
    carteiras: [{ id: carteiraB, nome: 'Banco do Bruno', saldo_inicial: 999 }],
    transacoes: [despesa('Segredo do Bruno', 'Lazer', 77.7, '2026-10-17', carteiraB, 'Banco do Bruno', '10')],
    metas: [{ nome: 'Meta do Bruno', valor_alvo: 5000 }],
  });

  // ── Usuária A ──────────────────────────────────────────────────────────────
  const { email, uid, carteira } = await cadastrar(page, 'Bia Config', 'Nubank');
  const freela = crypto.randomUUID();
  const salario = crypto.randomUUID();
  await semear(email, {
    // A renda principal é a "Salário", mesmo havendo uma ativa mais antiga.
    rendas: [
      { id: freela, descricao: 'Freela', valor: 300, dia_recebimento: 20, created_at: '2026-08-01T12:00:00.000Z', carteira_id: carteira },
      { id: salario, descricao: 'Salário', valor: 2000, dia_recebimento: 5, created_at: '2026-09-01T12:00:00.000Z', carteira_id: carteira },
    ],
    transacoes: [
      despesa('Almoço', 'Comida', 32.9, '2026-10-18', carteira, 'Nubank', '14'),
      despesa('Manicure', 'Unha', 45, '2026-10-17', carteira, 'Nubank', '13'),
      despesa('Design', 'Sobrancelha', 35, '2026-10-16', carteira, 'Nubank', '12'),
      despesa('=SOMA(1;2)', 'Outros', 10, '2026-10-15', null, null, '11'),
    ],
    contas_pagar: [{ descricao: 'Luz', categoria: 'Luz', valor: 150, recorrencia: 'mensal', dia_vencimento: 25 }],
    orcamento_categorias: [{ categoria: 'Comida', valor_planejado: 400 }],
    metas: [{ nome: 'Viagem', icone: 'plane', valor_alvo: 3000, valor_guardado: 500.25 }],
  });
  // O seed entra direto no mock: recarrega para o cache do React Query não ficar com a Início de antes do seed.
  await page.reload();
  await expect(page.getByRole('region', { name: 'Últimos gastos' }).getByRole('listitem')).toHaveCount(3);

  // ── Config: h1 e seções na ordem ───────────────────────────────────────────
  const nav = page.getByRole('navigation', { name: 'Navegação principal' });
  await nav.getByRole('link', { name: 'Config' }).click();
  await page.waitForURL(/\/configuracoes$/);
  await expect(page.getByRole('heading', { level: 1 }).first()).toHaveText('Configurações');
  await expect(page.locator('[data-secao]')).toHaveCount(6);
  expect(await page.locator('[data-secao]').evaluateAll((els) => els.map((e) => e.getAttribute('data-secao'))))
    .toEqual(['perfil', 'categorias', 'notificacoes', 'privacidade', 'sair', 'perigo']);
  const perfil = page.getByRole('region', { name: 'Perfil' });
  await expect(perfil.getByRole('button', { name: /Nome/ })).toContainText('Bia Config');
  await expect(perfil.getByRole('button', { name: /Dia do salário/ })).toContainText('Dia 5 · Salário');
  for (const alvo of [perfil.getByRole('button', { name: /Nome/ }), page.getByRole('link', { name: /Baixar meus dados/ })]) {
    expect((await alvo.boundingBox())!.height, 'alvo de toque < 44px').toBeGreaterThanOrEqual(44);
  }
  await page.screenshot({ path: path.join(EVIDENCIAS, '01-config.png'), animations: 'disabled' });

  // ── Editar o nome (persiste depois de recarregar) ──────────────────────────
  await perfil.getByRole('button', { name: /Nome/ }).click();
  const dialogNome = page.getByRole('dialog', { name: 'Editar nome' });
  await dialogNome.getByLabel('Seu nome').fill('Bia Atualizada');
  await dialogNome.getByRole('button', { name: 'Salvar' }).click();
  await expect(dialogNome).toBeHidden();
  await page.reload();
  await expect(page.getByRole('region', { name: 'Perfil' }).getByRole('button', { name: /Nome/ })).toContainText('Bia Atualizada');

  // ── Mudar o dia do salário (da renda Salário, não da Freela) ───────────────
  await page.getByRole('region', { name: 'Perfil' }).getByRole('button', { name: /Dia do salário/ }).click();
  const dialogDia = page.getByRole('dialog', { name: 'Dia do salário' });
  await dialogDia.getByLabel('Dia do recebimento').fill('12');
  await dialogDia.getByRole('button', { name: 'Salvar' }).click();
  await expect(dialogDia).toBeHidden();
  await expect(page.getByRole('region', { name: 'Perfil' }).getByRole('button', { name: /Dia do salário/ })).toContainText('Dia 12');
  // Fecha o aviso "Dia do salário salvo!" para ele não aparecer nos prints seguintes.
  await page.getByText('Dia do salário salvo!').locator('xpath=..').getByRole('button', { name: 'Fechar notificação' }).click();
  await expect(page.getByText('Dia do salário salvo!')).toBeHidden();
  const rendas = (await estadoMock()).tables.rendas.filter((r: { user_id: string }) => r.user_id === uid);
  expect(Object.fromEntries(rendas.map((r: { descricao: string; dia_recebimento: number }) => [r.descricao, r.dia_recebimento])))
    .toEqual({ Freela: 20, 'Salário': 12 });

  // ── Zona de perigo intacta ─────────────────────────────────────────────────
  const perigo = page.locator('[data-secao="perigo"]');
  await perigo.scrollIntoViewIfNeeded();
  await expect(perigo.getByRole('button', { name: 'Excluir minha conta' })).toBeVisible();
  await page.evaluate(() => window.scrollTo(0, document.scrollingElement!.scrollHeight));
  await page.screenshot({ path: path.join(EVIDENCIAS, '02-config-fim.png'), animations: 'disabled' });

  // ── Baixar meus dados → CSV do A, sem nada do B ────────────────────────────
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('region', { name: 'Privacidade' }).getByRole('link', { name: /Baixar meus dados/ }).click(),
  ]);
  expect(download.suggestedFilename()).toBe(`meudia-dados-${hojeSPReal()}.csv`);
  const bytes = fs.readFileSync((await download.path())!);
  expect([...bytes.subarray(0, 3)], 'sem BOM UTF-8').toEqual([0xef, 0xbb, 0xbf]);
  const csv = bytes.toString('utf8').slice(1);
  const linhas = csv.split('\r\n');
  expect(linhas[0]).toMatch(/^tabela;data;tipo;descricao;categoria;valor;banco;/);
  expect(csv).toContain('transacoes;2026-10-18;despesa;Almoço;Comida;32,90;Nubank;');
  expect(csv).toContain('transacoes;2026-10-16;despesa;Design;Sobrancelha;35,00;Nubank;');
  expect(csv, 'fórmula sem apóstrofo').toContain(`"'=SOMA(1;2)"`);
  for (const tabela of ['carteiras', 'rendas', 'contas_pagar', 'orcamento_categorias', 'metas']) {
    expect(linhas.some((l) => l.startsWith(`${tabela};`)), tabela).toBe(true);
  }
  expect(csv).toContain('500,25');
  for (const doOutro of ['Segredo do Bruno', 'Banco do Bruno', 'Meta do Bruno', '77,70', bruno.uid]) {
    expect(csv, `vazou do B: ${doOutro}`).not.toContain(doOutro);
  }
  expect(csv).not.toContain(uid);
  fs.copyFileSync((await download.path())!, path.join(EVIDENCIAS, 'exemplo-meudia-dados.csv'));

  // ── Categorias e limites → Orçamento, sem "Sobra prevista" ─────────────────
  await page.getByRole('region', { name: 'Categorias' }).getByRole('link', { name: /Categorias e limites/ }).click();
  await page.waitForURL(/\/financas\/orcamento$/);
  await expect(page.getByRole('heading', { name: 'Orçamento', level: 1 })).toBeVisible();
  const previsao = page.getByRole('region', { name: 'Previsão do mês' });
  await expect(previsao.getByText('No fim do mês sobra')).toBeVisible();
  await expect(page.getByText(/sobra prevista/i)).toHaveCount(0);
  await page.screenshot({ path: path.join(EVIDENCIAS, '04-orcamento-sem-sobra-prevista.png'), animations: 'disabled' });

  // ── Gastos: ícones de Comida (utensils), Unha (paintbrush) e Sobrancelha (eye) ──
  await nav.getByRole('link', { name: 'Gastos' }).click();
  await page.waitForURL(/\/financas\/gastos$/);
  const lista = page.getByRole('region', { name: 'Últimas despesas' });
  const icone = (texto: string) => lista.getByRole('listitem').filter({ hasText: texto }).locator('[data-icone]');
  await expect(icone('Almoço')).toHaveAttribute('data-icone', 'utensils');
  await expect(icone('Manicure')).toHaveAttribute('data-icone', 'paintbrush');
  await expect(icone('Design')).toHaveAttribute('data-icone', 'eye');
  await expect(icone('Design')).toHaveAttribute('data-categoria-icone', 'Sobrancelha');
  await expect(icone('Almoço').locator('svg')).toHaveClass(/lucide-utensils\b/);
  // Sobrancelha aparece no filtro de categoria.
  await expect(page.getByLabel('Categoria').locator('option', { hasText: 'Sobrancelha' })).toHaveCount(1);
  await page.screenshot({ path: path.join(EVIDENCIAS, '03-gastos-icones-novos.png'), animations: 'disabled' });

  // ── Sair → /login ──────────────────────────────────────────────────────────
  await nav.getByRole('link', { name: 'Config' }).click();
  await page.waitForURL(/\/configuracoes$/);
  await page.locator('[data-secao="sair"]').getByRole('button', { name: 'Sair' }).click();
  await page.waitForURL(/\/login/);
  await expect(page.getByRole('button', { name: 'Entrar' })).toBeVisible();
});

test('rota de exportação sem sessão responde 401', async ({ request }) => {
  const res = await request.get('/api/financas/exportar');
  expect(res.status()).toBe(401);
  expect(res.headers()['content-disposition']).toBeUndefined();
});
