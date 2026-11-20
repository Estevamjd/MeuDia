import type { Page } from '@playwright/test';
import { test, expect } from './mock-guard';

/**
 * P1.7: sessão concluída no Plano de treino (/treinos/plano → sessoes_treino) conta na aba Treino (/treinos), no dia
 * dela, sem somar em dobro com o Treino rápido do mesmo dia (`unirTreinosDoDia`). Relógio às 22:30 de quinta em BRT
 * (01:30 UTC de sexta): o dia é quinta em SP, não o dia UTC. Roda com o aparelho em São Paulo e em UTC (review Codex 3:
 * limites da consulta e dia da sessão não podem depender do fuso do aparelho). Modo Finanças, dados fictícios, só o mock.
 */
const MOCK_URL = 'http://127.0.0.1:54329';
const AGORA = '2026-11-20T01:30:00.000Z'; // quinta 19/11/2026, 22:30 em São Paulo
const run = Date.now().toString(36);
const SENHA = 'senhaForte123';

const relogio = (now: string | null) =>
  fetch(`${MOCK_URL}/__mock/clock`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ now }) });
test.beforeAll(async () => {
  await relogio(AGORA);
});
test.afterAll(async () => {
  await relogio(null);
});


async function fecharBanner(page: Page) {
  const banner = page.getByText('Instalar MeuDia').locator('xpath=ancestor::div[contains(@class,"fixed")][1]');
  if (await banner.isVisible().catch(() => false)) await banner.getByRole('button', { name: 'Fechar' }).click();
}

for (const fuso of ['America/Sao_Paulo', 'UTC'] as const) {
test.describe(`aparelho em ${fuso}`, () => {
test.use({ timezoneId: fuso });
// UUIDs fixos por fuso (o mock é um só para os dois testes).
const uuid = (n: number) => `f7000000-0000-4000-8000-${String(n + (fuso === 'UTC' ? 100 : 0)).padStart(12, '0')}`;

test('concluir a sessão do Plano marca o dia na semana do Treino, sem contar em dobro com o Treino rápido', async ({ page }) => {
  const EMAIL = `plano.semana.${fuso === 'UTC' ? 'utc' : 'sp'}.${run}@example.test`;
  await page.clock.setFixedTime(new Date(AGORA));

  await page.goto('/registro');
  await page.getByLabel('Nome').fill('Teste Plano');
  await page.getByLabel('Email').fill(EMAIL);
  await page.getByLabel('Senha', { exact: true }).fill(SENHA);
  await page.getByLabel('Confirmar senha').fill(SENHA);
  await page.getByRole('button', { name: 'Criar conta' }).click();
  await page.waitForURL(/\/onboarding/);
  await page.getByRole('button', { name: 'Pular por agora' }).click();
  await page.waitForURL(/\/financas$/);
  await fecharBanner(page);

  // Treino de quinta (dia_semana 4) com um exercício de 1 série.
  const r = await fetch(`${MOCK_URL}/__mock/seed`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      email: EMAIL,
      tables: {
        treinos: [{ id: uuid(1), nome: 'Superior B', dia_semana: 4, tipo: 'musculacao', descricao: null, ordem: 4, ativo: true }],
        exercicios: [{
          id: uuid(2), treino_id: uuid(1), nome: 'Supino reto', series: 1, repeticoes: 10, repeticoes_min: 10, repeticoes_max: 10,
          carga: null, descanso_segundos: 60, observacao: null, ordem: 0,
        }],
      },
    }),
  });
  expect(r.ok).toBe(true);

  // Antes: semana vazia.
  await expect(async () => {
    await page.goto('/treinos');
  }).toPass();
  await expect(page.getByTestId('treino-dias-semana')).toHaveText('0 dias');
  await expect(page.getByRole('listitem', { name: 'quinta: sem registro' })).toBeVisible();

  // Plano: hoje é quinta em SP (não sexta do UTC); marca a série e conclui.
  await page.getByRole('link', { name: /Plano de treino/ }).click();
  await page.waitForURL(/\/treinos\/plano$/);
  const dias = page.getByRole('group', { name: 'Dia da semana' });
  await expect(dias.getByRole('button', { name: /^Quinta, hoje/ })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByText('Superior B', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('Supino reto').first()).toBeVisible();
  await page.getByLabel('Kg da série 1').first().fill('40');
  await page.getByLabel('Repetições da série 1').first().fill('10');
  await page.getByRole('checkbox', { name: 'Série 1 feita' }).first().click();
  await page.getByRole('button', { name: 'Fechar timer' }).click();
  await page.getByRole('button', { name: 'Concluir treino' }).click();
  await expect(page.getByText(/Treino salvo: \d+ min\. Já conta na semana do Treino\./)).toBeVisible();

  const estado = await (await fetch(`${MOCK_URL}/__mock/state`)).json();
  const sessoes = (estado.tables.sessoes_treino ?? []).filter((s: { treino_id: string }) => s.treino_id === uuid(1));
  expect(sessoes).toHaveLength(1);
  expect(sessoes[0]).toMatchObject({ concluida: true });
  // Nada é copiado para registros_treino (união só na leitura).
  const idUsuario = sessoes[0].user_id;
  expect((estado.tables.registros_treino ?? []).filter((t: { user_id: string }) => t.user_id === idUsuario)).toEqual([]);

  // Volta pela navegação do Plano (SPA, sem reload): a semana do Treino mostra quinta feita.
  await page.getByRole('link', { name: /Treino rápido e semana/ }).click();
  await page.waitForURL(/\/treinos$/);
  await expect(page.getByTestId('treino-dias-semana')).toHaveText('1 dia');
  await expect(page.getByRole('listitem', { name: 'quinta: treinou' })).toBeVisible();
  await expect(page.getByRole('listitem', { name: 'sexta: ainda não chegou' })).toBeVisible();
  await expect(page.getByText('1 treino', { exact: false }).first()).toBeVisible();
  await expect(page.getByTestId('treino-plano-hoje')).toHaveText('Hoje você concluiu “Superior B” no plano. Já conta na semana.');
  const linhaPlano = page.getByTestId('registro').filter({ hasText: 'Superior B' });
  await expect(linhaPlano).toHaveAttribute('data-origem', 'plano');
  await expect(linhaPlano.getByText('Plano', { exact: true })).toBeVisible();
  await expect(linhaPlano.getByRole('link', { name: 'Ver Superior B no plano de treino' })).toHaveAttribute('href', '/treinos/plano');

  // Treino rápido no mesmo dia: continua 1 dia e 1 treino (o rápido substitui a sessão do Plano no dia).
  await page.getByLabel('O que treinou?').fill('Peito e tríceps');
  await page.getByLabel('Quanto tempo? (minutos, opcional)').fill('45');
  await page.getByRole('button', { name: 'Registrar treino' }).click();
  await expect(page.getByText('Treino registrado')).toBeVisible();
  await expect(page.getByTestId('registro').filter({ hasText: 'Peito e tríceps' })).toBeVisible();
  await expect(page.getByTestId('treino-dias-semana')).toHaveText('1 dia');
  await expect(page.getByText('1 treino · 45 min')).toBeVisible();
  await expect(page.getByTestId('registro').filter({ hasText: 'Superior B' })).toHaveCount(0);
  await expect(page.getByTestId('treino-plano-hoje')).toHaveCount(0);
});
});
}
