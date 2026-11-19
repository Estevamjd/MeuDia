import path from 'node:path';
import type { Page } from '@playwright/test';
import { test, expect } from './mock-guard';
import { pastaEvidencias } from './evidencias';

/**
 * Abas Treino e Dieta (19/11/2026, docs/ia-navegacao.md): barra Início · Treino · Dieta · Painel, registro
 * rápido, resumo da semana e selo de origem (Manual / WhatsApp). Também o campo "Seu WhatsApp" em Configurações.
 * Só mock (nunca Supabase real).
 */
const MOCK_URL = 'http://127.0.0.1:54329';
const AGORA = '2026-11-19T15:30:00.000Z'; // quinta, 12:30 em São Paulo → refeição sugerida: Almoço
const run = Date.now().toString(36);
const SENHA = 'senhaForte123';
const EMAIL = `registros.${run}@example.test`;

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

test('Treino e Dieta: abas, registro rápido, semana e origem; WhatsApp em Configurações', async ({ page }) => {
  await page.clock.setFixedTime(new Date(AGORA));
  const pasta = pastaEvidencias('registros');
  const shot = async (nome: string) => {
    await fecharBanner(page);
    await page.screenshot({ path: path.join(pasta, nome), animations: 'disabled', style: '.z-toast { display: none !important; }' });
  };

  await page.goto('/registro');
  await page.getByLabel('Nome').fill('Lia Registro');
  await page.getByLabel('Email').fill(EMAIL);
  await page.getByLabel('Senha', { exact: true }).fill(SENHA);
  await page.getByLabel('Confirmar senha').fill(SENHA);
  await page.getByRole('button', { name: 'Criar conta' }).click();
  await page.waitForURL(/\/onboarding/);
  await page.getByRole('button', { name: 'Pular por agora' }).click();
  await page.waitForURL(/\/financas$/);
  await fecharBanner(page);

  const nav = page.getByRole('navigation', { name: 'Navegação principal' });
  await expect(nav.getByRole('link')).toHaveText(['Início', 'Treino', 'Dieta', 'Painel']);
  await shot('nav-inicio-390.png');

  // ── Treino: vazio honesto, sem números inventados ──
  await nav.getByRole('link', { name: 'Treino' }).click();
  await page.waitForURL(/\/treinos$/);
  await expect(page.getByRole('heading', { name: 'Treino', level: 1 })).toBeVisible();
  await expect(page.getByTestId('treino-dias-semana')).toHaveText('0 dias');
  await expect(page.getByText('Nenhum treino ainda. O primeiro conta muito.')).toBeVisible();
  await expect(page.getByText('Seus treinos aparecem aqui, com a data e de onde vieram.')).toBeVisible();
  await shot('treino-vazio-390.png');

  await page.getByRole('button', { name: 'Peito', exact: true }).click();
  await expect(page.getByLabel('O que treinou?')).toHaveValue('Peito');
  await page.getByLabel('Quanto tempo? (minutos, opcional)').fill('40');
  await page.getByRole('button', { name: 'Registrar treino' }).click();
  const linhas = page.getByTestId('registro');
  await expect(linhas).toHaveCount(1);
  await expect(linhas.first()).toContainText('Peito');
  await expect(linhas.first()).toContainText('Hoje · 40 min');
  await expect(linhas.first().locator('[data-origem="manual"]')).toBeVisible();
  await expect(page.getByTestId('treino-dias-semana')).toHaveText('1 dia');
  await expect(page.getByLabel('O que treinou?')).toHaveValue('');

  // Um treino que chegou pelo WhatsApp (gravado como o RPC grava: origem whatsapp).
  const r = await fetch(`${MOCK_URL}/__mock/seed`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, tables: { registros_treino: [{ id: 'a1000000-0000-4000-8000-000000000001', data: '2026-11-17', descricao: 'Pernas', duracao_min: 50, origem: 'whatsapp', created_at: '2026-11-17T22:00:00.000Z' }] } }),
  });
  expect(r.ok, await r.clone().text()).toBe(true);
  await page.reload();
  await expect(linhas).toHaveCount(2);
  await expect(linhas.nth(1)).toContainText('Pernas');
  await expect(linhas.nth(1).locator('[data-origem="whatsapp"]')).toBeVisible();
  await expect(page.getByTestId('treino-dias-semana')).toHaveText('2 dias');
  await expect(page.getByText('2 treinos · 90 min')).toBeVisible();
  await expect(nav.getByRole('link', { name: 'Treino' })).toHaveAttribute('aria-current', 'page');
  await page.evaluate(() => window.scrollTo(0, 0));
  await shot('treino-com-registros-390.png');

  // Excluir pede confirmação.
  await page.getByRole('button', { name: 'Excluir treino Pernas' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Excluir' }).click();
  await expect(linhas).toHaveCount(1);

  // ── Dieta: tipo sugerido pela hora (12:30 → Almoço) ──
  await nav.getByRole('link', { name: 'Dieta' }).click();
  await page.waitForURL(/\/refeicoes$/);
  await expect(page.getByRole('heading', { name: 'Dieta', level: 1 })).toBeVisible();
  await expect(page.getByTestId('refeicoes-hoje')).toHaveText('0 refeições');
  await expect(page.getByText('Nenhuma refeição anotada hoje.')).toBeVisible();
  await expect(page.getByRole('radio', { name: 'Almoço' })).toHaveAttribute('aria-checked', 'true');
  await shot('dieta-vazio-390.png');
  await page.getByLabel('O que comeu?').fill('arroz, feijão e frango');
  await page.getByRole('button', { name: 'Registrar almoço' }).click();
  await expect(linhas).toHaveCount(1);
  await expect(linhas.first()).toContainText('arroz, feijão e frango');
  await expect(page.getByTestId('refeicoes-hoje')).toHaveText('1 refeição');
  await page.getByRole('radio', { name: 'Café da manhã' }).click();
  await page.getByLabel('O que comeu?').fill('pão com ovo');
  await page.getByRole('button', { name: 'Registrar café da manhã' }).click();
  await expect(linhas).toHaveCount(2);
  await expect(linhas.first()).toContainText('pão com ovo'); // café vem antes do almoço
  await page.evaluate(() => window.scrollTo(0, 0));
  await shot('dieta-com-registros-390.png');

  // ── Menu ☰: Plano de treino e Calorias e peso continuam acessíveis ──
  await page.getByRole('button', { name: 'Abrir menu' }).click();
  const menu = page.getByRole('dialog', { name: '✦ MeuDia' });
  await expect(menu.getByText('Saúde', { exact: true })).toBeVisible();
  await shot('menu-secoes-390.png');
  await menu.getByRole('link', { name: 'Configurações' }).click();
  await page.waitForURL(/\/configuracoes$/);

  // ── Seu WhatsApp: normaliza para dígitos com DDI ──
  await page.getByRole('button', { name: /Seu WhatsApp/ }).click();
  await page.getByLabel('Número com DDD').fill('(11) 98888-7777');
  await page.getByRole('button', { name: 'Salvar' }).click();
  await expect(page.getByRole('button', { name: /Seu WhatsApp/ })).toContainText('+55 (11) 98888-7777');
  const estado = await (await fetch(`${MOCK_URL}/__mock/state`)).json();
  const perfil = estado.tables.profiles.find((p: { email: string }) => p.email === EMAIL);
  expect(perfil.whatsapp).toBe('5511988887777');
  const treinos = estado.tables.registros_treino.filter((t: { user_id: string }) => t.user_id === perfil.id);
  expect(treinos).toEqual([expect.objectContaining({ descricao: 'Peito', duracao_min: 40, origem: 'app', data: '2026-11-19' })]);
});
