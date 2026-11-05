import path from 'node:path';
import type { Page } from '@playwright/test';
import { MODELO_TREINO_V1 } from '../../../packages/shared/src/constants/modelo-saude';
import { test, expect } from './mock-guard';
import { pastaEvidencias } from './evidencias';

/**
 * Saúde e Treino, F2 (Caderno B): no modo Finanças a tela /treinos aparece (menu lateral) e mostra o treino do dia
 * com a tabela SÉRIE · ANTERIOR · KG · REPS · ✓. ANTERIOR vem de series_realizadas; tocar copia; exercício novo "—".
 * Dados de exemplo (modelo do BRIEF §3.3 + uma sessão antiga). Nunca fala com Supabase real.
 */
const MOCK_URL = 'http://127.0.0.1:54329';
const AGORA = '2026-11-02T13:00:00.000Z'; // segunda-feira, 10:00 em São Paulo
const SEMANA_PASSADA = '2026-10-26T13:00:00.000Z';
const run = Date.now().toString(36);
const SENHA = 'senhaForte123';
const EMAIL = `treino.${run}@example.test`;

const uuid = (n: number) => `f2000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

const relogio = (now: string | null) =>
  fetch(`${MOCK_URL}/__mock/clock`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ now }) });
test.beforeAll(async () => {
  await relogio(AGORA);
});
test.afterAll(async () => {
  await relogio(null);
});

/** Modelo do BRIEF (seg a sex) + uma sessão concluída na segunda passada com supino e remada. */
function cenario() {
  const treinos: Record<string, unknown>[] = [];
  const exercicios: Record<string, unknown>[] = [];
  let n = 1;
  const ids: Record<string, string> = {};
  for (const t of MODELO_TREINO_V1.filter((m) => m.dia_semana >= 1 && m.dia_semana <= 5)) {
    const treinoId = uuid(n++);
    treinos.push({ id: treinoId, nome: t.nome, dia_semana: t.dia_semana, tipo: t.tipo, descricao: null, ordem: t.dia_semana, ativo: true });
    t.exercicios.forEach((e, ordem) => {
      const id = uuid(n++);
      if (t.dia_semana === 1) ids[e.nome] = id;
      exercicios.push({
        id, treino_id: treinoId, nome: e.nome, series: e.series, repeticoes: e.repeticoes_min,
        repeticoes_min: e.repeticoes_min, repeticoes_max: e.repeticoes_max, carga: null, descanso_segundos: 90, observacao: null, ordem,
      });
    });
  }
  const sessao = uuid(900);
  const serie = (ex: string, numero: number, carga: number, reps: number) => ({
    id: uuid(n++), sessao_id: sessao, exercicio_id: ids[ex], serie_numero: numero, carga, repeticoes: reps, concluida: true,
  });
  return {
    treinos,
    exercicios,
    sessoes_treino: [{ id: sessao, treino_id: treinos[0]!.id, inicio: SEMANA_PASSADA, concluida: true, duracao_minutos: 52, created_at: SEMANA_PASSADA }],
    series_realizadas: [
      serie('Supino reto', 1, 60, 10), serie('Supino reto', 2, 60, 9), serie('Supino reto', 3, 57.5, 8),
      serie('Remada', 1, 50, 10), serie('Remada', 2, 50, 10), serie('Remada', 3, 50, 9),
    ],
  };
}

async function entrar(page: Page) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(EMAIL);
  await page.getByLabel('Senha', { exact: true }).fill(SENHA);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await page.waitForURL(/\/financas$/);
}

async function fecharBanner(page: Page) {
  const banner = page.getByText('Instalar MeuDia').locator('xpath=ancestor::div[contains(@class,"fixed")][1]');
  if (await banner.isVisible().catch(() => false)) await banner.getByRole('button', { name: 'Fechar' }).click();
}

test('modo Finanças: /treinos aparece e mostra o treino do dia no Caderno B', async ({ page, browser }) => {
  await page.clock.setFixedTime(new Date(AGORA));
  const pasta = pastaEvidencias('treinos');
  const shot = (nome: string, fullPage = false) =>
    page.screenshot({ path: path.join(pasta, nome), fullPage, animations: 'disabled', style: '.z-toast { display: none !important; }' });

  await page.goto('/registro');
  await page.getByLabel('Nome').fill('Teste Treino');
  await page.getByLabel('Email').fill(EMAIL);
  await page.getByLabel('Senha', { exact: true }).fill(SENHA);
  await page.getByLabel('Confirmar senha').fill(SENHA);
  await page.getByRole('button', { name: 'Criar conta' }).click();
  await page.waitForURL(/\/onboarding/);
  await page.getByRole('button', { name: 'Pular por agora' }).click();
  await page.waitForURL(/\/financas$/);
  await fecharBanner(page);

  // Conta nova, sem treino: o dia mostra o estado vazio genérico.
  await page.getByRole('button', { name: 'Abrir menu' }).click();
  await page.getByRole('dialog', { name: '✦ MeuDia' }).getByRole('link', { name: 'Treinos' }).click();
  await page.waitForURL(/\/treinos$/);
  await expect(page.getByRole('heading', { name: 'Treino', level: 1 })).toBeVisible();
  await expect(page.getByText('Nenhum treino na segunda.')).toBeVisible();
  await expect(page.getByRole('switch', { name: 'Lembrete de treino' })).toHaveAttribute('aria-checked', 'false');
  await shot('treino-vazio-390.png');

  const r = await fetch(`${MOCK_URL}/__mock/seed`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: EMAIL, tables: cenario() }),
  });
  expect(r.ok).toBe(true);
  await page.reload();

  // Segunda: Superior A, supino aberto com ANTERIOR da semana passada; remada fechada com o resumo.
  const dias = page.getByRole('group', { name: 'Dia da semana' });
  await expect(dias.getByRole('button')).toHaveText(['S', 'T', 'Q', 'Q', 'S', 'S', 'D']);
  await expect(dias.getByRole('button', { name: /^Segunda, hoje/ })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByText('01 / 06')).toBeVisible();
  await expect(page.getByText('3 × 8–12').first()).toBeVisible();
  await expect(page.getByText('últ. 50 × 10, 10, 9')).toBeVisible();
  await page.getByRole('button', { name: 'Copiar série anterior 1: 60 × 10' }).click();
  await expect(page.getByLabel('Kg da série 1').first()).toHaveValue('60');
  await expect(page.getByLabel('Repetições da série 1').first()).toHaveValue('10');
  await page.getByRole('checkbox', { name: 'Série 1 feita' }).first().click();
  await page.getByRole('button', { name: 'Fechar timer' }).click();
  await expect(page.getByRole('checkbox', { name: 'Série 1 feita' }).first()).toHaveAttribute('aria-checked', 'true');
  await page.getByRole('button', { name: 'Copiar série anterior 2: 60 × 9' }).click();
  await page.getByLabel('Repetições da série 2').first().fill('10');
  await page.getByRole('checkbox', { name: 'Série 2 feita' }).first().click();
  await page.getByRole('button', { name: 'Fechar timer' }).click();
  await expect(page.getByRole('checkbox', { name: 'Série 2 feita' }).first()).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByRole('button', { name: 'Concluir treino' })).toBeVisible();
  await page.evaluate(() => window.scrollTo(0, 0));
  await shot('treino-depois-390.png');
  await shot('treino-depois-390-inteira.png', true);

  // Exercício sem histórico: "—" em todas as séries.
  await page.getByRole('button', { name: /Desenvolvimento/ }).click();
  await expect(page.getByRole('table', { name: 'Séries de Desenvolvimento' }).getByLabel('Sem registro anterior')).toHaveCount(2);

  // Quarta: Recuperação riscada, sem lista vazia.
  const quarta = dias.getByRole('button', { name: 'Quarta, recuperação' });
  await expect(quarta).toHaveClass(/line-through/);
  await quarta.click();
  await expect(page.getByRole('heading', { name: 'Recuperação' })).toBeVisible();
  await expect(page.getByText('Sem musculação programada.')).toBeVisible();
  await shot('treino-recuperacao-390.png');

  // Desktop 1440×900: mesma tela, com o item Treinos no menu lateral (seção Saúde).
  const desktop = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'pt-BR', timezoneId: 'America/Sao_Paulo', bypassCSP: true });
  // Mesma barreira do mock-guard no contexto novo: nada sai para um Supabase real.
  const reais: string[] = [];
  await desktop.route(/https?:\/\/[^/]*\.supabase\.(co|in|net)\//, (rota) => {
    reais.push(rota.request().url());
    return rota.abort();
  });
  const pc = await desktop.newPage();
  await pc.clock.setFixedTime(new Date(AGORA));
  await entrar(pc);
  await pc.goto('/treinos');
  await expect(pc.getByText('01 / 06')).toBeVisible();
  await expect(pc.getByRole('link', { name: /Treinos/ }).first()).toBeVisible();
  await pc.screenshot({ path: path.join(pasta, 'treino-depois-1440.png'), animations: 'disabled' });
  await pc.screenshot({ path: path.join(pasta, 'treino-depois-1440-inteira.png'), fullPage: true, animations: 'disabled' });
  await desktop.close();
  expect(reais, 'requisição para Supabase real bloqueada').toEqual([]);
});
