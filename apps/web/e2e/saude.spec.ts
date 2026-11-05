import path from 'node:path';
import type { Page } from '@playwright/test';
import { MODELO_TREINO_V1 } from '../../../packages/shared/src/constants/modelo-saude';
import { test, expect } from './mock-guard';
import { pastaEvidencias } from './evidencias';

/**
 * Saúde e Treino, F2 fatia 2 (Caderno B): cadastro de saúde (3 telas) na primeira visita a /saude, Hoje, Dieta e Peso,
 * vazio do Caderno no Treino e o link "editar" inteiro (QA R1). Modo Finanças. Dados fictícios. Nunca fala com Supabase real.
 */
const MOCK_URL = 'http://127.0.0.1:54329';
const AGORA = '2026-11-02T13:00:00.000Z'; // segunda-feira, 10:00 em São Paulo
const HOJE = '2026-11-02';
const run = Date.now().toString(36);
const SENHA = 'senhaForte123';
const EMAIL = `saude.${run}@example.test`;

const relogio = (now: string | null) =>
  fetch(`${MOCK_URL}/__mock/clock`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ now }) });
test.beforeAll(async () => {
  await relogio(AGORA);
});
test.afterAll(async () => {
  await relogio(null);
});

const uuid = (n: number) => `f3000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const somarDias = (iso: string, n: number) => {
  const [a, m, d] = iso.split('-').map(Number) as [number, number, number];
  return new Date(Date.UTC(a, m - 1, d + n)).toISOString().slice(0, 10);
};

/** Treino do modelo (seg a sex), duas refeições de hoje com valores digitados e 30 dias de peso (fictícios). */
function cenario() {
  const treinos: Record<string, unknown>[] = [];
  const exercicios: Record<string, unknown>[] = [];
  let n = 1;
  for (const t of MODELO_TREINO_V1.filter((m) => m.dia_semana >= 1 && m.dia_semana <= 5)) {
    const treinoId = uuid(n++);
    treinos.push({ id: treinoId, nome: t.nome, dia_semana: t.dia_semana, tipo: t.tipo, descricao: null, ordem: t.dia_semana, ativo: true });
    t.exercicios.forEach((e, ordem) => {
      exercicios.push({
        id: uuid(n++), treino_id: treinoId, nome: e.nome, series: e.series, repeticoes: e.repeticoes_min,
        repeticoes_min: e.repeticoes_min, repeticoes_max: e.repeticoes_max, carga: null, descanso_segundos: 90, observacao: null, ordem,
      });
    });
  }
  const item = (nome: string, calorias: number | null, proteina: number | null) => ({ nome, calorias, proteina, fonte: 'manual' });
  const refeicoes = [
    { tipo: 'cafe', data: HOJE, items: [item('pão francês', 300, 9), item('ovos', 210, 18), item('queijo', 102, 7)], total_calorias: 612, total_proteina: 34 },
    { tipo: 'lanche_manha', data: HOJE, items: [item('banana', 98, 1), item('iogurte natural', 120, 7), item('aveia', 100, 4)], total_calorias: 318, total_proteina: 12 },
  ];
  // Peso subindo de ~70,0 para ~71,3 em 30 dias, com variação diária pequena e alguns dias sem pesar.
  const registros_peso = Array.from({ length: 30 }, (_, i) => ({
    data: somarDias(HOJE, i - 29),
    peso: Math.round((70 + (i * 1.3) / 29 + [0.2, -0.3, 0.1, -0.1, 0.3, -0.2][i % 6]!) * 10) / 10,
  })).filter((_, i) => i % 7 !== 3 && i !== 29); // hoje já tem o peso do cadastro (UNIQUE user_id, data)
  return { treinos, exercicios, refeicoes, registros_peso };
}

async function fecharBanner(page: Page) {
  const banner = page.getByText('Instalar MeuDia').locator('xpath=ancestor::div[contains(@class,"fixed")][1]');
  if (await banner.isVisible().catch(() => false)) await banner.getByRole('button', { name: 'Fechar' }).click();
}

test('modo Finanças: cadastro de saúde, Hoje, Dieta, Peso e o vazio do Caderno', async ({ page, browser }) => {
  await page.clock.setFixedTime(new Date(AGORA));
  const pasta = pastaEvidencias('saude');
  const shot = async (p: Page, nome: string, fullPage = false) => {
    await fecharBanner(p);
    await p.screenshot({ path: path.join(pasta, nome), fullPage, animations: 'disabled', style: '.z-toast { display: none !important; }' });
  };

  await page.goto('/registro');
  await page.getByLabel('Nome').fill('Teste Saude');
  await page.getByLabel('Email').fill(EMAIL);
  await page.getByLabel('Senha', { exact: true }).fill(SENHA);
  await page.getByLabel('Confirmar senha').fill(SENHA);
  await page.getByRole('button', { name: 'Criar conta' }).click();
  await page.waitForURL(/\/onboarding/);
  await page.getByRole('button', { name: 'Pular por agora' }).click();
  await page.waitForURL(/\/financas$/);
  await fecharBanner(page);

  // Treino sem nada: vazio do Caderno (tela 08), sem o EmptyState de gradiente.
  await page.goto('/treinos');
  await expect(page.getByRole('heading', { name: 'Nenhum treino na segunda.' })).toBeVisible();
  const vazio = page.locator('[data-vazio-caderno]');
  await expect(vazio.getByRole('button', { name: 'Criar treino' })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Saúde e treino' }).getByRole('link', { name: 'Treino' })).toHaveAttribute('aria-current', 'page');
  await shot(page, 'treino-vazio-depois-390.png');

  // Primeira visita a /saude pelo menu: cadastro de saúde.
  await page.getByRole('button', { name: 'Abrir menu' }).click();
  await page.getByRole('dialog', { name: '✦ MeuDia' }).getByRole('link', { name: 'Saúde' }).click();
  await page.waitForURL(/\/saude$/);
  await expect(page.getByRole('heading', { name: 'Sobre você' })).toBeVisible();
  await page.getByLabel('Idade').fill('28');
  await page.getByRole('button', { name: 'Masculino' }).click();
  await page.getByLabel('Altura').fill('175');
  await page.getByLabel('Peso atual').fill('70,0');
  await shot(page, 'onb1-depois-390.png');
  await page.getByRole('button', { name: 'Continuar' }).click();
  await expect(page.getByRole('heading', { name: 'Rotina' })).toBeVisible();
  await page.getByRole('radio', { name: /Moderado/ }).click();
  await page.getByRole('button', { name: 'Ganhar peso' }).click();
  await shot(page, 'onb2-depois-390.png');
  await page.getByRole('button', { name: 'Ver metas' }).click();
  await expect(page.getByRole('heading', { name: 'Metas' })).toBeVisible();
  await expect(page.getByText('3.102', { exact: true })).toBeVisible();
  await expect(page.getByText(/gasto estimado 2\.820 kcal \+ 10% para ganho/)).toBeVisible();
  await expect(page.getByText('126', { exact: true })).toBeVisible();
  await shot(page, 'onb3-depois-390.png');
  await page.getByRole('button', { name: 'Salvar e começar' }).click();
  await expect(page.getByRole('heading', { name: 'Saúde', level: 1 })).toBeVisible();

  // O cadastro salvou em profiles (altura em metros, meta de kcal) e o peso de hoje.
  const estado = await (await fetch(`${MOCK_URL}/__mock/state`)).json();
  const perfil = estado.tables.profiles.find((p: { email: string }) => p.email === EMAIL);
  expect(perfil).toMatchObject({ altura: 1.75, peso_atual: 70, meta_calorias: 3102, objetivo: 'ganhar_massa' });

  const r = await fetch(`${MOCK_URL}/__mock/seed`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: EMAIL, tables: cenario() }),
  });
  expect(r.ok, await r.clone().text()).toBe(true);
  await page.reload();

  // Hoje: treino do dia, 930 / 3.102 = 30%, refeições 2 de 6.
  await expect(page.getByRole('heading', { name: 'Superior A' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Começar →' })).toHaveAttribute('href', '/treinos');
  await expect(page.getByText('930', { exact: true })).toBeVisible();
  await expect(page.getByText('/ 3.102')).toBeVisible();
  await expect(page.getByText('30%', { exact: true })).toBeVisible();
  await expect(page.getByText('Refeições · 2 de 6')).toBeVisible();
  await page.evaluate(() => window.scrollTo(0, 0));
  await shot(page, 'hoje-depois-390.png');
  await shot(page, 'hoje-depois-390-inteira.png', true);

  // Tocar no ponto do almoço marca como feita (cria o registro com os itens do modelo, sem valor).
  await page.getByRole('checkbox', { name: 'Almoço feita' }).click();
  await expect(page.getByRole('checkbox', { name: 'Almoço feita' })).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByText('Refeições · 3 de 6')).toBeVisible();

  // Dieta: linha do tempo completa, "sem valor" (nunca 0), selo e citação da TACO.
  await page.getByRole('navigation', { name: 'Saúde e treino' }).getByRole('link', { name: 'Dieta' }).click();
  await page.waitForURL(/\/saude\/dieta$/);
  await expect(page.getByText('930 / 3.102 kcal')).toBeVisible();
  await expect(page.getByText('612', { exact: true })).toBeVisible();
  await expect(page.getByText('sem valor').first()).toBeVisible();
  await expect(page.getByText('fora da TACO').first()).toBeVisible();
  await expect(page.getByText(/TACO 4ª ed\. \(NEPA\/UNICAMP, 2011\)/)).toBeVisible();
  await expect(page.getByText(/Total parcial: 4 itens sem valor/)).toBeVisible();
  await expect(page.getByRole('switch', { name: 'Lembrete de refeição' })).toHaveAttribute('aria-checked', 'false');
  // Editar o almoço: kcal do arroz entra no total; o resto segue sem valor.
  await page.getByRole('button', { name: 'Editar almoço' }).click();
  await page.getByLabel('Kcal do item 1').fill('250');
  await page.getByRole('button', { name: 'Salvar' }).click();
  await expect(page.getByText('1.180 / 3.102 kcal')).toBeVisible();
  await page.evaluate(() => window.scrollTo(0, 0));
  await shot(page, 'dieta-depois-390.png');
  await shot(page, 'dieta-depois-390-inteira.png', true);

  // Peso: gráfico 30 dias, peso-meta com data, ritmo e meta realista.
  await page.getByRole('navigation', { name: 'Saúde e treino' }).getByRole('link', { name: 'Peso' }).click();
  await page.waitForURL(/\/saude\/peso$/);
  await expect(page.getByRole('button', { name: '30 dias' })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Editar peso-meta' }).click();
  await page.getByRole('textbox', { name: 'Peso-meta', exact: true }).fill('75');
  await page.locator('#meta-prazo').fill('2027-01-25');
  await page.getByRole('button', { name: 'Salvar' }).click();
  await expect(page.getByText(/até 25 jan/)).toBeVisible();
  await expect(page.getByText(/Nesse prazo a meta pede/)).toBeVisible();
  await expect(page.getByText('meta 75 kg')).toBeVisible();
  await page.getByRole('button', { name: '0,375%' }).click();
  await page.evaluate(() => window.scrollTo(0, 0));
  await shot(page, 'peso-depois-390.png');
  await shot(page, 'peso-depois-390-inteira.png', true);

  // Treino: "editar" inteiro (QA R1). DM Sans do next/font, letter-spacing normal, uma linha só.
  await page.getByRole('navigation', { name: 'Saúde e treino' }).getByRole('link', { name: 'Treino' }).click();
  await page.waitForURL(/\/treinos$/);
  const editar = page.getByRole('button', { name: 'editar', exact: true }).first();
  await editar.scrollIntoViewIfNeeded();
  const medida = await editar.evaluate((el) => {
    const cs = getComputedStyle(el);
    const range = document.createRange();
    range.selectNodeContents(el);
    return { fonte: cs.fontFamily, espaco: cs.letterSpacing, quebra: cs.whiteSpace, render: cs.textRendering, linhas: range.getClientRects().length };
  });
  expect(medida.fonte).toMatch(/DM_Sans|DM Sans/);
  expect(medida.fonte).not.toMatch(/^'?DM Sans'?, sans-serif$/);
  expect(medida.espaco).toBe('normal');
  expect(medida.quebra).toBe('nowrap');
  expect(medida.render).toBe('geometricprecision');
  expect(medida.linhas).toBe(1);
  await page.evaluate(() => window.scrollBy(0, -120));
  await shot(page, 'treino-editar-390.png');

  // Desktop 1440×900: mesmas telas, com o perfil de saúde deste aparelho.
  const perfilLocal = await page.evaluate(() => Object.entries(localStorage).filter(([k]) => k.startsWith('meudia:saude:')));
  const desktop = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'pt-BR', timezoneId: 'America/Sao_Paulo', bypassCSP: true });
  const reais: string[] = [];
  await desktop.route(/https?:\/\/[^/]*\.supabase\.(co|in|net)\//, (rota) => {
    reais.push(rota.request().url());
    return rota.abort();
  });
  await desktop.addInitScript((itens: [string, string][]) => {
    for (const [k, v] of itens) localStorage.setItem(k, v);
  }, perfilLocal);
  const pc = await desktop.newPage();
  await pc.clock.setFixedTime(new Date(AGORA));
  await pc.goto('/login');
  await pc.getByLabel('Email').fill(EMAIL);
  await pc.getByLabel('Senha', { exact: true }).fill(SENHA);
  await pc.getByRole('button', { name: 'Entrar' }).click();
  await pc.waitForURL(/\/financas$/);
  await fecharBanner(pc);
  for (const [rota, nome, espera] of [
    ['/saude', 'hoje', 'Superior A'],
    ['/saude/dieta', 'dieta', '1.180 / 3.102 kcal'],
    ['/saude/peso', 'peso', 'meta 75 kg'],
  ] as const) {
    await pc.goto(rota);
    await expect(pc.getByText(espera).first()).toBeVisible();
    await fecharBanner(pc);
    await shot(pc, `${nome}-depois-1440.png`);
    await shot(pc, `${nome}-depois-1440-inteira.png`, true);
  }
  await desktop.close();
  expect(reais, 'requisição para Supabase real bloqueada').toEqual([]);
});
