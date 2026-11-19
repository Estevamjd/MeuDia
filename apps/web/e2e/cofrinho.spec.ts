import path from 'node:path';
import type { Page } from '@playwright/test';
import { test, expect } from './mock-guard';
import { pastaEvidencias } from './evidencias';

/**
 * 014 Cofrinho (modelo aprovado em 19/11/2026), iPhone 13 contra o mock do Supabase:
 * o Cofrinho começa com o que havia nos bancos, gasto não mexe nele, só Guardar / Tirar / Corrigir e o fechamento do mês.
 */

const MOCK_URL = 'http://127.0.0.1:54329';
const SENHA = 'senhaForte123';
const run = Date.now().toString(36);
const brl = (valor: string) => new RegExp(`^−?R\\$\\s${valor.replace('.', '\\.')}$`);

test.describe.configure({ mode: 'serial' });
const relogio = (now: string | null) =>
  fetch(`${MOCK_URL}/__mock/clock`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ now }) });
test.afterAll(() => relogio(null));

const coletarErros = (page: Page) => {
  const erros: string[] = [];
  page.on('pageerror', (err) => erros.push(`${err.name}: ${err.message}`));
  page.on('response', (res) => {
    if (res.status() >= 400) erros.push(`${res.request().method()} ${res.url()} → ${res.status()}`);
  });
  return erros;
};

async function cadastrar(page: Page, nome: string, agora: string) {
  await relogio(agora);
  await page.clock.setFixedTime(new Date(agora));
  const email = `${nome.toLowerCase().replace(/\s/g, '.')}.${run}@example.test`;
  await page.goto('/registro');
  await page.getByLabel('Nome').fill(nome);
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Senha', { exact: true }).fill(SENHA);
  await page.getByLabel('Confirmar senha').fill(SENHA);
  await page.getByRole('button', { name: 'Criar conta' }).click();
  await page.waitForURL(/\/onboarding/);
  await page.getByRole('button', { name: 'Continuar' }).click();
  await page.getByLabel('Banco ou carteira 1').fill('Nubank');
  await page.getByLabel('Quanto tem hoje (1)').fill('30000');
  await page.getByRole('button', { name: 'Concluir' }).click();
  await page.waitForURL(/\/financas$/);
  const banner = page.getByText('Instalar MeuDia').locator('xpath=ancestor::div[contains(@class,"fixed")][1]');
  await expect(banner).toBeVisible();
  await banner.getByRole('button', { name: 'Fechar' }).click();
  // Primeiro acesso com banco: o Cofrinho congela o que havia nos bancos.
  await expect(page.getByTestId('linha-cofrinho-valor')).toHaveText(brl('300,00'));
  // Renda 2.000 no dia 1 (sem "Recebi"), Aluguel 700 (dia 5) e Celular 80 (dia 1).
  const res = await fetch(`${MOCK_URL}/__mock/seed`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      email,
      tables: {
        rendas: [{ descricao: 'Renda principal', valor: 2000, dia_recebimento: 1, created_at: '2026-09-01T12:00:00.000Z' }],
        contas_pagar: [
          { descricao: 'Aluguel', categoria: 'Moradia', valor: 700, recorrencia: 'mensal', dia_vencimento: 5, created_at: '2026-09-01T12:00:00.000Z' },
          { descricao: 'Celular', categoria: 'Celular', valor: 80, recorrencia: 'mensal', dia_vencimento: 1, created_at: '2026-09-01T12:00:00.000Z' },
        ],
      },
    }),
  });
  expect(res.status, await res.clone().text()).toBe(200);
  const estado = await (await fetch(`${MOCK_URL}/__mock/state`)).json();
  const uid = estado.users.find((u: { email: string }) => u.email === email).id as string;
  return { uid };
}

const meus = async (uid: string, tabela: string) => {
  const estado = await (await fetch(`${MOCK_URL}/__mock/state`)).json();
  return (estado.tables[tabela] ?? []).filter((r: { user_id: string }) => r.user_id === uid);
};

test('último dia do mês: "Sobrou R$ X" com valor editável; Guardar soma uma vez; Bancos: Guardar, Tirar e Corrigir; gasto não mexe', async ({ page }) => {
  const erros = coletarErros(page);
  const pasta = pastaEvidencias('cofrinho');
  const shot = (nome: string) => page.screenshot({ path: path.join(pasta, nome), animations: 'disabled', style: '.z-toast { display: none !important; }' });
  // 31/10/2026 12:00 em SP: último dia de outubro.
  const { uid } = await cadastrar(page, 'Lia Cofrinho', '2026-10-31T15:00:00.000Z');
  await page.reload();

  // Deve sobrar em outubro: 2.000 (previsão) − 780 (contas fixas) − 0 = 1.220.
  await expect(page.getByTestId('previsao-fim-mes-valor')).toHaveText(brl('1.220,00'));
  const folha = page.getByRole('dialog', { name: 'Fechamento do mês' });
  await expect(folha.getByTestId('fechamento-pergunta')).toHaveText(/^Sobrou R\$\s1\.220,00 em outubro\. Quer guardar no Cofrinho\?$/);
  const campo = folha.getByLabel('Quanto guardar');
  await expect(campo).toHaveValue(brl('1.220,00'));
  await shot('01-fechamento-pergunta.png');
  await campo.fill('100000');
  await expect(campo).toHaveValue(brl('1.000,00'));
  await folha.getByRole('button', { name: 'Guardar' }).click();
  await expect(folha).toBeHidden();
  const cofrinho = page.getByTestId('linha-cofrinho-valor');
  await expect(cofrinho).toHaveText(brl('1.300,00'));
  expect((await meus(uid, 'cofrinho_movimentos')).map((m: { tipo: string; valor: number }) => `${m.tipo}:${Number(m.valor)}`)).toEqual(['inicial:300', 'sobra:1000']);

  // Uma vez por mês: recarregar não pergunta de novo.
  await page.reload();
  await expect(page.getByTestId('resumo-mes-conta')).toBeVisible();
  await expect(page.getByRole('dialog', { name: 'Fechamento do mês' })).toHaveCount(0);
  expect(await meus(uid, 'cofrinho_fechamentos')).toHaveLength(1);
  await shot('02-inicio-resumo-conta.png');

  // Gastei 50: baixa a sobra, nunca o Cofrinho.
  await page.getByRole('region', { name: 'Últimos lançamentos' }).getByRole('button', { name: 'Gastei' }).click();
  const gasto = page.getByRole('dialog');
  await gasto.getByLabel('Valor', { exact: true }).fill('5000');
  await gasto.getByRole('radio', { name: 'Comida' }).click();
  await gasto.getByRole('button', { name: 'Salvar gasto' }).click();
  await expect(gasto).toBeHidden();
  await expect(page.getByTestId('resumo-gastos')).toHaveText(/^− R\$\s50,00$/);
  await expect(page.getByTestId('previsao-fim-mes-valor')).toHaveText(brl('1.170,00'));
  await expect(cofrinho).toHaveText(brl('1.300,00'));

  // Bancos: o cartão do Cofrinho e o total dos bancos (que cai com o gasto) separados.
  await page.getByTestId('linha-cofrinho').click();
  await page.waitForURL(/\/financas\/carteiras$/);
  const valor = page.getByTestId('cofrinho-valor');
  await expect(valor).toHaveText(brl('1.300,00'));
  await expect(page.getByTestId('total-bancos')).toContainText(/Total nos bancos: R\$\s250,00/);
  await shot('03-bancos-cofrinho.png');
  const card = page.getByTestId('card-cofrinho');

  await card.getByRole('button', { name: 'Guardar' }).click();
  let modal = page.getByRole('dialog', { name: 'Guardar no Cofrinho' });
  await modal.getByLabel('Quanto guardar?').fill('10000');
  await modal.getByRole('button', { name: 'Guardar' }).click();
  await expect(modal).toBeHidden();
  await expect(valor).toHaveText(brl('1.400,00'));

  await card.getByRole('button', { name: 'Tirar' }).click();
  modal = page.getByRole('dialog', { name: 'Tirar do Cofrinho' });
  await modal.getByLabel('Quanto tirar?').fill('1000000');
  await expect(modal.getByText('Esse valor é maior do que tem no Cofrinho.')).toBeVisible();
  await expect(modal.getByRole('button', { name: 'Tirar' })).toBeDisabled();
  await modal.getByLabel('Quanto tirar?').fill('10000');
  await modal.getByRole('button', { name: 'Tirar' }).click();
  await expect(modal).toBeHidden();
  await expect(valor).toHaveText(brl('1.300,00'));

  await card.getByRole('button', { name: 'Corrigir o valor do Cofrinho' }).click();
  modal = page.getByRole('dialog', { name: 'Corrigir o Cofrinho' });
  await modal.getByLabel('Quanto você tem guardado de verdade?').fill('123456');
  await expect(modal).toContainText(/passa a ter R\$\s1\.234,56/);
  await shot('04-corrigir-cofrinho.png');
  await modal.getByRole('button', { name: 'Corrigir' }).click();
  await expect(modal).toBeHidden();
  await expect(valor).toHaveText(brl('1.234,56'));
  // Nada disso mexe nos bancos.
  await expect(page.getByTestId('total-bancos')).toContainText(/Total nos bancos: R\$\s250,00/);
  expect((await meus(uid, 'cofrinho_movimentos')).map((m: { tipo: string }) => m.tipo)).toEqual(['inicial', 'sobra', 'guardar', 'tirar', 'corrigir']);

  // Gastos: as contas fixas do mês com "a pagar"; o gasto do dia a dia separado.
  await page.goto('/financas/gastos');
  await expect(page.getByTestId('contas-fixas-mes')).toContainText(/Contas fixas de outubro/);
  await expect(page.getByTestId('total-contas-fixas')).toHaveText(brl('780,00'));
  await expect(page.getByTestId('contas-fixas-mes').locator('[data-conta-fixa="a-pagar"]')).toHaveCount(2);
  await expect(page.getByTestId('total-gastos')).toHaveText(brl('50,00'));
  await shot('05-gastos-contas-fixas.png');
  expect(erros, 'erros na página ou respostas HTTP ≥ 400').toEqual([]);
});

test('"Agora não": grava a resposta, não mexe no Cofrinho e não pergunta de novo no mês', async ({ page }) => {
  const erros = coletarErros(page);
  // 30/11/2026 12:00 em SP: último dia de novembro.
  const { uid } = await cadastrar(page, 'Lia Agora Nao', '2026-11-30T15:00:00.000Z');
  await page.reload();
  const folha = page.getByRole('dialog', { name: 'Fechamento do mês' });
  await expect(folha.getByTestId('fechamento-pergunta')).toHaveText(/^Sobrou R\$\s1\.220,00 em novembro\./);
  await folha.getByRole('button', { name: 'Agora não' }).click();
  await expect(folha).toBeHidden();
  await expect(page.getByTestId('linha-cofrinho-valor')).toHaveText(brl('300,00'));
  await page.reload();
  await expect(page.getByTestId('resumo-mes-conta')).toBeVisible();
  await expect(page.getByRole('dialog', { name: 'Fechamento do mês' })).toHaveCount(0);
  expect((await meus(uid, 'cofrinho_fechamentos')).map((f: { decisao: string }) => f.decisao)).toEqual(['agora_nao']);
  expect((await meus(uid, 'cofrinho_movimentos')).map((m: { tipo: string }) => m.tipo)).toEqual(['inicial']);
  expect(erros, 'erros na página ou respostas HTTP ≥ 400').toEqual([]);
});
