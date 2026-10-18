import fs from 'node:fs';
import path from 'node:path';
import type { Locator } from '@playwright/test';
import { test, expect } from '../mock-guard';

/**
 * Medição da troca de abas (iPhone 13 / WebKit, build de produção contra o mock). Fora do e2e:mock do CI.
 *
 *   cd apps/web && pnpm exec playwright test -c playwright.perf.config.ts
 *
 * Variáveis: PERF_RODADAS (padrão 5), PERF_SAIDA (JSON; padrão e2e/artifacts/perf/troca-abas.json),
 * MOCK_LATENCY_MS (no config, padrão 150: atraso de cada chamada ao "Supabase", do navegador e do middleware).
 * Por troca: tempo do clique até a tela nova responder (URL trocou) e até o conteúdo principal estar na tela
 * (relógio do próprio navegador), chamadas ao Supabase do navegador e do servidor e requests RSC do Next.
 * Imprime a mediana das rodadas; cada rodada é um contexto novo (cache do React Query vazio).
 */

const MOCK_URL = 'http://127.0.0.1:54329';
const RODADAS = Number(process.env.PERF_RODADAS || 5);
const SAIDA = process.env.PERF_SAIDA || path.join(__dirname, '..', 'artifacts', 'perf', 'troca-abas.json');
const SENHA = 'senhaForte123';
const EMAIL = `perf.${Date.now().toString(36)}@example.test`;

/** Conteúdo principal de cada aba (já com dados do mock, não o skeleton). */
const PRONTO = {
  inicio: `location.pathname === '/financas' && !!document.querySelector('[data-testid="previsao-7dias-valor"]')`,
  contas: `location.pathname === '/financas/contas' && !!document.querySelector('[aria-label="Editar conta Aluguel"]')`,
  orcamento: `location.pathname === '/financas/orcamento' && !!document.querySelector('[aria-label="Editar renda Salário"]')`,
  carteiras: `location.pathname === '/financas/carteiras' && !!document.querySelector('[aria-label="Corrigir saldo de Nubank"]')`,
} as const;
type Aba = keyof typeof PRONTO;
const CAMINHO: Record<Aba, string> = { inicio: '/financas', contas: '/financas/contas', orcamento: '/financas/orcamento', carteiras: '/financas/carteiras' };

interface Medida {
  troca: string;
  respostaMs: number;
  prontoMs: number;
  supabaseNavegador: number;
  supabaseServidor: number;
  rsc: number;
  /** Chamadas ao mock por rota (navegador + servidor), para achar refetch e waterfall. */
  rotas: Record<string, number>;
}
const medidas: Medida[][] = [];

const mock = async (caminho: string, init?: RequestInit) => (await fetch(`${MOCK_URL}${caminho}`, init)).json();

test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
  // Usuário com 1 banco, renda, 3 contas e alguns gastos, criado direto no mock (sem UI).
  await mock('/__mock/clock', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ now: null }) });
  const json = { 'content-type': 'application/json', apikey: 'mock-anon-key' };
  const cadastro = await mock('/auth/v1/signup', { method: 'POST', headers: json, body: JSON.stringify({ email: EMAIL, password: SENHA, data: { nome: 'Perf' } }) });
  const token = cadastro.access_token ?? cadastro.session?.access_token;
  const uid = cadastro.user?.id ?? cadastro.id;
  expect(token, 'signup do mock devolve sessão').toBeTruthy();
  const rest = async (tabela: string, linhas: object) => {
    const r = await fetch(`${MOCK_URL}/rest/v1/${tabela}`, {
      method: 'POST', headers: { ...json, authorization: `Bearer ${token}`, prefer: 'return=representation' }, body: JSON.stringify(linhas),
    });
    expect(r.ok, `insert em ${tabela}: ${r.status}`).toBe(true);
    return (await r.json()) as { id: string }[];
  };
  const upd = await fetch(`${MOCK_URL}/rest/v1/profiles?id=eq.${uid}`, {
    method: 'PATCH', headers: { ...json, authorization: `Bearer ${token}` }, body: JSON.stringify({ nome: 'Perf', onboarding_feito: true }),
  });
  expect(upd.ok).toBe(true);
  const [nubank] = await rest('carteiras', [{ user_id: uid, nome: 'Nubank', saldo_inicial: 1500 }]);
  await rest('rendas', [{ user_id: uid, descricao: 'Salário', valor: 3000, dia_recebimento: 5 }]);
  await rest('contas_pagar', [
    { user_id: uid, descricao: 'Aluguel', categoria: 'Moradia', valor: 1200, recorrencia: 'mensal', dia_vencimento: 10 },
    { user_id: uid, descricao: 'Luz', categoria: 'Luz', valor: 150, recorrencia: 'mensal', dia_vencimento: 20 },
    { user_id: uid, descricao: 'Internet', categoria: 'Internet', valor: 100, recorrencia: 'mensal', dia_vencimento: 25 },
  ]);
  await rest('transacoes', ['Comida', 'Transporte', 'Lazer', 'Comida', 'Mercado'].map((categoria, i) => ({
    user_id: uid, tipo: 'despesa', categoria, descricao: categoria, valor: 20 + i * 7, carteira_id: nubank!.id,
  })));
});

test.afterAll(async () => {
  if (!medidas.length) return;
  const trocas = medidas[0]!.map((m) => m.troca);
  const mediana = (xs: number[]) => {
    const o = [...xs].sort((a, b) => a - b);
    const meio = Math.floor(o.length / 2);
    return o.length % 2 ? o[meio]! : (o[meio - 1]! + o[meio]!) / 2;
  };
  const resumo = trocas.map((troca, i) => {
    const col = (k: 'respostaMs' | 'prontoMs' | 'supabaseNavegador' | 'supabaseServidor' | 'rsc') => mediana(medidas.map((r) => r[i]![k]));
    return { troca, respostaMs: Math.round(col('respostaMs')), prontoMs: Math.round(col('prontoMs')), supabaseNavegador: col('supabaseNavegador'), supabaseServidor: col('supabaseServidor'), rsc: col('rsc') };
  });
  fs.mkdirSync(path.dirname(SAIDA), { recursive: true });
  fs.writeFileSync(SAIDA, JSON.stringify({ rodadas: medidas.length, latenciaMockMs: Number(process.env.MOCK_LATENCY_MS || 0), resumo, medidas }, null, 2));
  console.log(`\nTroca de abas — mediana de ${medidas.length} rodadas (JSON em ${SAIDA})`);
  console.log('| troca | resposta (ms) | conteúdo pronto (ms) | Supabase navegador | Supabase servidor | RSC |');
  console.log('| --- | ---: | ---: | ---: | ---: | ---: |');
  for (const r of resumo) console.log(`| ${r.troca} | ${r.respostaMs} | ${r.prontoMs} | ${r.supabaseNavegador} | ${r.supabaseServidor} | ${r.rsc} |`);
});

for (let rodada = 1; rodada <= RODADAS; rodada++) {
  test(`rodada ${rodada}`, async ({ page }) => {
    test.setTimeout(120_000);
    let navegador = 0;
    let rsc = 0;
    page.on('request', (req) => {
      const url = req.url();
      if (url.startsWith(MOCK_URL) && req.method() !== 'OPTIONS') navegador++;
      else if (url.includes('_rsc=') || req.headers()['rsc'] === '1') rsc++;
    });

    await page.goto('/login');
    await page.getByLabel('Email').fill(EMAIL);
    await page.getByLabel('Senha', { exact: true }).fill(SENHA);
    await page.getByRole('button', { name: /^entrar$/i }).click();
    await page.waitForFunction(PRONTO.inicio, undefined, { timeout: 30_000 });
    // Deixa terminar prefetch e queries da primeira carga (networkidle não serve: o app consulta periodicamente).
    await page.waitForTimeout(2500);

    const nav = page.getByRole('navigation', { name: 'Navegação principal' });
    const rodadaAtual: Medida[] = [];
    const trocar = async (nome: string, alvo: Locator, aba: Aba) => {
      await page.waitForTimeout(300);
      await mock('/__mock/stats/reset', { method: 'POST' });
      navegador = 0;
      rsc = 0;
      const origem = await page.evaluate(() => location.pathname);
      await alvo.evaluate((el) => {
        (window as unknown as { __t0: number }).__t0 = performance.now();
        (el as HTMLElement).click();
      });
      const resposta = await page.waitForFunction(
        (de) => (location.pathname !== de ? performance.now() - (window as unknown as { __t0: number }).__t0 : false),
        origem, { polling: 'raf', timeout: 30_000 },
      );
      const pronto = await page.waitForFunction(
        `(${PRONTO[aba]}) ? performance.now() - window.__t0 : false`, undefined, { polling: 'raf', timeout: 30_000 },
      );
      // Requests que chegam logo depois (refetch ao montar) também contam para a troca.
      await page.waitForTimeout(700);
      const stats = await mock('/__mock/stats');
      rodadaAtual.push({
        troca: nome, respostaMs: (await resposta.jsonValue()) as number, prontoMs: (await pronto.jsonValue()) as number,
        supabaseNavegador: navegador, supabaseServidor: stats.servidor, rsc, rotas: stats.rotas,
      });
      expect(await page.evaluate(() => location.pathname)).toBe(CAMINHO[aba]);
    };
    const tab = (nome: string) => nav.getByRole('link', { name: nome });
    const gaveta = async () => {
      await page.getByRole('button', { name: 'Abrir menu' }).click();
      return page.getByRole('dialog', { name: '✦ MeuDia' }).getByRole('link', { name: 'Bancos e carteira' });
    };

    await trocar('Início → Contas', tab('Contas'), 'contas');
    await trocar('Contas → Orçamento', tab('Orçamento'), 'orcamento');
    await trocar('Orçamento → Início (volta)', tab('Início'), 'inicio');
    await trocar('Início → Contas (volta)', tab('Contas'), 'contas');
    await trocar('Contas → Orçamento (volta)', tab('Orçamento'), 'orcamento');
    await trocar('Orçamento → Bancos (gaveta)', await gaveta(), 'carteiras');
    await trocar('Bancos → Início (volta)', tab('Início'), 'inicio');
    medidas.push(rodadaAtual);
  });
}

