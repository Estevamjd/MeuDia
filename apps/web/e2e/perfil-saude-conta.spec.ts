import type { Browser, Page } from '@playwright/test';
import { FORMULA_SAUDE_VERSAO, GANHO_SEMANAL_MEIO_PCT } from '../../../packages/shared/src/constants/saude';
import { test, expect } from './mock-guard';

/**
 * P1.7: perfil de saúde na conta (`perfil_saude`, 016), localStorage só como cache.
 * (a) perfil só no aparelho + conta sem linha → a visita a /saude sobe o perfil (migração);
 * (b) linha na conta + aparelho novo (localStorage vazio) → /saude mostra as metas sem abrir o cadastro;
 * (c) sem a 016 (PGRST205) → "Agora não" fica no aparelho sem erro na tela e sobe quando a tabela aparece;
 * (d) cache velho no aparelho (até com relógio adiantado) + linha mais nova na conta → mostra a conta e não a toca;
 * (e) /saude/peso em aparelho novo com o GET do perfil lento → ritmo/meta desligados até carregar; depois, o ritmo
 *     grava só ritmo_pct (respostas, metas e prazo intactos);
 * (f) GET do perfil falha (503 por /__mock/falha) → aviso "Sem conexão" e controles desligados; a rede volta → uma releitura,
 *     controles religados, nada gravado.
 * Migração = INSERT ... ON CONFLICT DO NOTHING (Prefer resolution=ignore-duplicates); edição = PATCH só da coluna.
 * Modo Finanças, dados fictícios, só o mock-supabase.
 */
const MOCK_URL = 'http://127.0.0.1:54329';
const AGORA = '2026-11-19T15:00:00.000Z'; // quinta, 12:00 em São Paulo
const run = Date.now().toString(36);
const SENHA = 'senhaForte123';

const post = (rota: string, corpo: unknown) =>
  fetch(`${MOCK_URL}${rota}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(corpo) });
const estado = async () => (await fetch(`${MOCK_URL}/__mock/state`)).json();
const idDe = async (email: string): Promise<string> =>
  (await estado()).users.find((u: { email: string }) => u.email === email).id;
const linhaDe = async (userId: string) =>
  ((await estado()).tables.perfil_saude ?? []).find((p: { user_id: string }) => p.user_id === userId) ?? null;

test.beforeAll(async () => {
  await post('/__mock/clock', { now: AGORA });
});
test.afterAll(async () => {
  await post('/__mock/clock', { now: null });
  await post('/__mock/ausentes', { tabelas: [] });
  await post('/__mock/atraso', { rota: 'GET /rest/v1/perfil_saude', ms: 0 });
  await post('/__mock/falha', { rota: 'GET /rest/v1/perfil_saude', status: 0 });
});

/** Gravações do navegador em perfil_saude (método + Prefer), para provar insert-only e PATCH parcial. */
function gravacoesPerfil(page: Page) {
  const lista: { metodo: string; prefer: string; corpo: unknown }[] = [];
  page.on('request', (req) => {
    if (!req.url().includes('/rest/v1/perfil_saude') || req.method() === 'GET' || req.method() === 'OPTIONS') return;
    lista.push({ metodo: req.method(), prefer: req.headers()['prefer'] ?? '', corpo: req.postDataJSON() });
  });
  return lista;
}

const respostas = { idade: 31, sexo: 'feminino', alturaCm: 165, pesoKg: 62, nivel: 'moderado', objetivo: 'manter' };
// Metas fora do padrão de profiles (meta_calorias 2000) para provar de onde veio o número.
const metas = (kcal: number) => ({
  kcal, kcalCalculada: kcal, kcalOrigem: 'calculada', proteinaMinG: 112, proteinaMaxG: 112, proteinaCalculadaG: 112,
  proteinaOrigem: 'calculada', proteinaGKg: 1.8,
});

async function fecharBanner(page: Page) {
  const banner = page.getByText('Instalar MeuDia').locator('xpath=ancestor::div[contains(@class,"fixed")][1]');
  if (await banner.isVisible().catch(() => false)) await banner.getByRole('button', { name: 'Fechar' }).click();
}

async function criarConta(page: Page, email: string) {
  await page.goto('/registro');
  await page.getByLabel('Nome').fill('Teste Perfil');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Senha', { exact: true }).fill(SENHA);
  await page.getByLabel('Confirmar senha').fill(SENHA);
  await page.getByRole('button', { name: 'Criar conta' }).click();
  await page.waitForURL(/\/onboarding/);
  await page.getByRole('button', { name: 'Pular por agora' }).click();
  await page.waitForURL(/\/financas$/);
  await fecharBanner(page);
}

async function irPara(page: Page, rota: string) {
  await expect(async () => {
    await page.goto(rota);
  }).toPass();
}

/** Aparelho novo: contexto limpo (sem localStorage), com o bloqueio do Supabase real. */
async function aparelhoNovo(browser: Browser, email: string, antesDeEntrar?: (page: Page) => Promise<void>) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'pt-BR', timezoneId: 'America/Sao_Paulo', bypassCSP: true });
  const reais: string[] = [];
  await ctx.route(/https?:\/\/[^/]*\.supabase\.(co|in|net)\//, (rota) => {
    reais.push(rota.request().url());
    return rota.abort();
  });
  const page = await ctx.newPage();
  await page.clock.setFixedTime(new Date(AGORA));
  await antesDeEntrar?.(page);
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Senha', { exact: true }).fill(SENHA);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await page.waitForURL(/\/financas$/);
  await fecharBanner(page);
  return { ctx, page, reais };
}

test('(a) perfil só neste aparelho e conta sem linha: a visita a /saude sobe o perfil para a conta', async ({ page }) => {
  const email = `perfil.migra.${run}@example.test`;
  await page.clock.setFixedTime(new Date(AGORA));
  await criarConta(page, email);
  const uid = await idDe(email);
  expect(await linhaDe(uid)).toBeNull();

  // Perfil do tempo do localStorage (antes da 016), com prazo e ritmo.
  await page.evaluate(
    ({ chave, valor }) => localStorage.setItem(chave, valor),
    {
      chave: `meudia:saude:v1:${uid}`,
      valor: JSON.stringify({
        versao: 1, estado: 'respondido', respostas, metas: metas(2345), prazoMeta: '2027-03-01',
        ritmoPct: GANHO_SEMANAL_MEIO_PCT, formulaVersao: FORMULA_SAUDE_VERSAO, atualizadoEm: '2026-11-01T12:00:00.000Z',
      }),
    },
  );

  const gravacoes = gravacoesPerfil(page);
  await irPara(page, '/saude');
  await expect(page.getByRole('heading', { name: 'Saúde', level: 1 })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Sobre você' })).toHaveCount(0);
  await expect(page.getByText('/ 2.345')).toBeVisible();

  await expect.poll(() => linhaDe(uid)).toMatchObject({
    user_id: uid, estado: 'respondido', respostas, metas: { kcal: 2345 }, prazo_meta: '2027-03-01',
    ritmo_pct: GANHO_SEMANAL_MEIO_PCT, formula_versao: FORMULA_SAUDE_VERSAO,
  });
  // Insert-only: um POST com resolution=ignore-duplicates e nenhum merge/PATCH.
  expect(gravacoes.map((g) => g.metodo)).toEqual(['POST']);
  expect(gravacoes[0]?.prefer).toContain('resolution=ignore-duplicates');
  expect(gravacoes[0]?.prefer).not.toContain('merge-duplicates');
  // O cache passa a ter o updated_at da conta (não sobe de novo na próxima carga).
  const linha = await linhaDe(uid);
  await expect
    .poll(() => page.evaluate((k) => JSON.parse(localStorage.getItem(k) ?? 'null')?.atualizadoEm, `meudia:saude:v1:${uid}`))
    .toBe(linha.updated_at);
});

test('(b) linha na conta e aparelho novo: /saude mostra as metas salvas sem abrir o cadastro', async ({ page, browser }) => {
  const email = `perfil.remoto.${run}@example.test`;
  await page.clock.setFixedTime(new Date(AGORA));
  await criarConta(page, email);
  const r = await post('/__mock/seed', {
    email,
    tables: {
      perfil_saude: [{
        estado: 'respondido', respostas, metas: metas(2457), prazo_meta: null, ritmo_pct: GANHO_SEMANAL_MEIO_PCT,
        formula_versao: FORMULA_SAUDE_VERSAO,
      }],
    },
  });
  expect(r.ok, await r.clone().text()).toBe(true);

  const { ctx, page: outro, reais } = await aparelhoNovo(browser, email);
  expect(await outro.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('meudia:saude:')))).toEqual([]);
  await irPara(outro, '/saude');
  await expect(outro.getByRole('heading', { name: 'Saúde', level: 1 })).toBeVisible();
  await expect(outro.getByText('/ 2.457')).toBeVisible();
  await expect(outro.getByRole('heading', { name: 'Sobre você' })).toHaveCount(0);
  // E o aparelho novo passa a ter o cache.
  const uid = await idDe(email);
  await expect
    .poll(() => outro.evaluate((k) => JSON.parse(localStorage.getItem(k) ?? 'null')?.metas?.kcal, `meudia:saude:v1:${uid}`))
    .toBe(2457);
  await ctx.close();
  expect(reais, 'requisição para Supabase real bloqueada').toEqual([]);
});

test('(c) sem a 016: "Agora não" fica no aparelho sem erro na tela e sobe quando a tabela aparece', async ({ page }) => {
  const email = `perfil.sem016.${run}@example.test`;
  await page.clock.setFixedTime(new Date(AGORA));
  await criarConta(page, email);
  const uid = await idDe(email);
  try {
    expect((await post('/__mock/ausentes', { tabelas: ['perfil_saude'] })).ok).toBe(true);
    await irPara(page, '/saude');
    // Nem conta nem aparelho: o cadastro abre.
    await expect(page.getByRole('heading', { name: 'Sobre você' })).toBeVisible();
    await page.getByRole('button', { name: 'Agora não' }).click();
    await expect(page.getByRole('heading', { name: 'Saúde', level: 1 })).toBeVisible();
    // (o role=alert do anunciador de rotas do Next existe sempre; o erro visível seria a mensagem/toast abaixo)
    await expect(page.getByText(/Não deu para salvar/)).toHaveCount(0);
    await expect
      .poll(() => page.evaluate((k) => JSON.parse(localStorage.getItem(k) ?? 'null')?.estado, `meudia:saude:v1:${uid}`))
      .toBe('adiado');
    expect(await linhaDe(uid)).toBeNull();

    // Recarregar sem a 016 não reabre o cadastro nem mostra erro.
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Saúde', level: 1 })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Sobre você' })).toHaveCount(0);
  } finally {
    await post('/__mock/ausentes', { tabelas: [] });
  }

  // 016 aplicada: a próxima carga migra o perfil do aparelho.
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Saúde', level: 1 })).toBeVisible();
  await expect.poll(() => linhaDe(uid)).toMatchObject({ user_id: uid, estado: 'adiado', respostas: null, metas: null });
});

test('(d) cache velho no aparelho (relógio adiantado) e linha mais nova na conta: mostra a conta e não a sobrescreve', async ({ page }) => {
  const email = `perfil.velho.${run}@example.test`;
  await page.clock.setFixedTime(new Date(AGORA));
  await criarConta(page, email);
  const uid = await idDe(email);
  const r = await post('/__mock/seed', {
    email,
    tables: {
      perfil_saude: [{
        user_id: uid, estado: 'respondido', respostas, metas: metas(2600), prazo_meta: '2027-02-01', ritmo_pct: 0.5,
        formula_versao: FORMULA_SAUDE_VERSAO,
      }],
    },
  });
  expect(r.ok, await r.clone().text()).toBe(true);
  const antes = await linhaDe(uid);
  // Cache deste aparelho: outro perfil, carimbado "no futuro" (relógio do aparelho adiantado). Não decide nada.
  await page.evaluate(
    ({ chave, valor }) => localStorage.setItem(chave, valor),
    {
      chave: `meudia:saude:v1:${uid}`,
      valor: JSON.stringify({
        versao: 1, estado: 'adiado', respostas: null, metas: null, prazoMeta: null,
        ritmoPct: 0.25, formulaVersao: FORMULA_SAUDE_VERSAO, atualizadoEm: '2099-01-01T00:00:00.000Z',
      }),
    },
  );
  const gravacoes = gravacoesPerfil(page);
  await irPara(page, '/saude');
  await expect(page.getByText('/ 2.600')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Sobre você' })).toHaveCount(0);
  await expect
    .poll(() => page.evaluate((k) => JSON.parse(localStorage.getItem(k) ?? 'null')?.metas?.kcal, `meudia:saude:v1:${uid}`))
    .toBe(2600);
  // Recarrega: segue a conta; a linha do mock fica idêntica (inclusive updated_at) e nada foi gravado.
  await page.reload();
  await expect(page.getByText('/ 2.600')).toBeVisible();
  expect(await linhaDe(uid)).toEqual(antes);
  expect(gravacoes).toEqual([]);
});

test('(e) /saude/peso em aparelho novo com o perfil lento: controles desligados até carregar e a linha não é sobrescrita', async ({ page, browser }) => {
  const email = `perfil.peso.${run}@example.test`;
  await page.clock.setFixedTime(new Date(AGORA));
  await criarConta(page, email);
  const uid = await idDe(email);
  const r = await post('/__mock/seed', {
    email,
    tables: {
      perfil_saude: [{
        user_id: uid, estado: 'respondido', respostas, metas: metas(2457), prazo_meta: '2027-03-01', ritmo_pct: 0.5,
        formula_versao: FORMULA_SAUDE_VERSAO,
      }],
      registros_peso: [{ data: '2026-11-18', peso: 62.4 }, { data: '2026-11-19', peso: 62.2 }],
    },
  });
  expect(r.ok, await r.clone().text()).toBe(true);
  const antes = await linhaDe(uid);

  const { ctx, page: outro, reais } = await aparelhoNovo(browser, email);
  const gravacoes = gravacoesPerfil(outro);
  try {
    expect((await post('/__mock/atraso', { rota: 'GET /rest/v1/perfil_saude', ms: 4000 })).ok).toBe(true);
    await irPara(outro, '/saude/peso');
    const ritmo = outro.getByRole('group', { name: 'Ritmo por semana (% do peso)' });
    await expect(ritmo.getByRole('button', { name: '0,25%' })).toBeVisible();
    // Perfil ainda carregando: nenhum controle que grava no perfil responde.
    await expect(ritmo).toHaveAttribute('aria-busy', 'true');
    for (const nome of ['0,25%', '0,375%', '0,5%']) await expect(ritmo.getByRole('button', { name: nome })).toBeDisabled();
    await expect(outro.getByRole('button', { name: 'Editar peso-meta' })).toBeDisabled();
    await ritmo.getByRole('button', { name: '0,25%' }).click({ force: true });
    expect(gravacoes).toEqual([]);

    // Carregou: mostra o da conta (0,5% e o prazo) e libera.
    await expect(ritmo.getByRole('button', { name: '0,5%' })).toBeEnabled({ timeout: 15_000 });
    await expect(ritmo.getByRole('button', { name: '0,5%' })).toHaveAttribute('aria-pressed', 'true');
    expect(await linhaDe(uid)).toEqual(antes);
  } finally {
    await post('/__mock/atraso', { rota: 'GET /rest/v1/perfil_saude', ms: 0 });
  }

  // Trocar o ritmo grava só ritmo_pct.
  await outro.getByRole('group', { name: 'Ritmo por semana (% do peso)' }).getByRole('button', { name: '0,25%' }).click();
  await expect.poll(async () => (await linhaDe(uid))?.ritmo_pct).toBe(0.25);
  const depois = await linhaDe(uid);
  expect(depois).toMatchObject({ estado: 'respondido', respostas, metas: { kcal: 2457 }, prazo_meta: '2027-03-01' });
  expect(gravacoes.map((g) => [g.metodo, g.corpo])).toEqual([['PATCH', { ritmo_pct: 0.25 }]]);
  await ctx.close();
  expect(reais, 'requisição para Supabase real bloqueada').toEqual([]);
});

test('(f) leitura do perfil falha e a rede volta: aviso só leitura, uma releitura e controles religados, linha intacta', async ({ page, browser }) => {
  const email = `perfil.volta.${run}@example.test`;
  await page.clock.setFixedTime(new Date(AGORA));
  await criarConta(page, email);
  const uid = await idDe(email);
  const r = await post('/__mock/seed', {
    email,
    tables: {
      perfil_saude: [{
        user_id: uid, estado: 'respondido', respostas, metas: metas(2457), prazo_meta: '2027-03-01', ritmo_pct: 0.5,
        formula_versao: FORMULA_SAUDE_VERSAO,
      }],
      registros_peso: [{ data: '2026-11-19', peso: 62.2 }],
    },
  });
  expect(r.ok, await r.clone().text()).toBe(true);
  const antes = await linhaDe(uid);
  const ROTA = 'GET /rest/v1/perfil_saude';
  const leituras = async () => ((await (await fetch(`${MOCK_URL}/__mock/stats`)).json()).rotas[ROTA] ?? 0) as number;

  const { ctx, page: outro, reais } = await aparelhoNovo(browser, email);
  const gravacoes = gravacoesPerfil(outro);
  try {
    expect((await post('/__mock/falha', { rota: ROTA, status: 503 })).ok).toBe(true);
    await irPara(outro, '/saude/peso');
    const ritmo = outro.getByRole('group', { name: 'Ritmo por semana (% do peso)' });
    await expect(outro.getByText('Sem conexão com a sua conta agora.', { exact: false })).toBeVisible({ timeout: 20_000 });
    for (const nome of ['0,25%', '0,375%', '0,5%']) await expect(ritmo.getByRole('button', { name: nome })).toBeDisabled();
    await expect(outro.getByRole('button', { name: 'Editar peso-meta' })).toBeDisabled();
    const leiturasNaFalha = await leituras();
    expect(leiturasNaFalha).toBeGreaterThanOrEqual(1);

    // A rede volta (eventos offline/online do navegador): uma releitura só, sem tocar em "tentar de novo".
    await post('/__mock/falha', { rota: ROTA, status: 0 });
    await outro.evaluate(() => {
      window.dispatchEvent(new Event('offline'));
      window.dispatchEvent(new Event('online'));
    });
    await expect(ritmo.getByRole('button', { name: '0,5%' })).toBeEnabled({ timeout: 15_000 });
    await expect(ritmo.getByRole('button', { name: '0,5%' })).toHaveAttribute('aria-pressed', 'true');
    await expect(outro.getByText('Sem conexão com a sua conta agora.', { exact: false })).toHaveCount(0);
    await outro.waitForTimeout(500);
    expect((await leituras()) - leiturasNaFalha).toBe(1);
    expect(gravacoes).toEqual([]);
    expect(await linhaDe(uid)).toEqual(antes);
  } finally {
    await post('/__mock/falha', { rota: ROTA, status: 0 });
  }
  await ctx.close();
  expect(reais, 'requisição para Supabase real bloqueada').toEqual([]);
});
