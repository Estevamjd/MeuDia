import path from 'node:path';
import type { Locator, Page } from '@playwright/test';
import { test, expect } from './mock-guard';
import { pastaEvidencias } from './evidencias';

const MOCK_URL = 'http://127.0.0.1:54329';
const AGORA = '2026-10-18T15:00:00.000Z'; // 12:00 em São Paulo (UTC−3)

const run = Date.now().toString(36);
const SENHA = 'senhaForte123';

/** "R$ 1.555,00" tolerando o NBSP do Intl. */
const brl = (valor: string) => new RegExp(`^R\\$\\s${valor.replace('.', '\\.')}$`);

test.beforeAll(async () => {
  await fetch(`${MOCK_URL}/__mock/clock`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ now: AGORA }) });
});
test.afterAll(async () => {
  // Devolve o relógio real para os demais specs do mesmo mock.
  await fetch(`${MOCK_URL}/__mock/clock`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ now: null }) });
});

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
  await page.getByRole('button', { name: 'adicionar outro' }).click();
  await page.getByLabel('Banco ou carteira 2').fill('Caixa');
  await page.getByLabel('Quanto tem hoje (2)').fill('5000');
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

  await bottomNav.getByRole('link', { name: 'Contas' }).click();
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

test('excluir lançamentos, transferências e banco; criar, guardar e excluir meta', async ({ page }) => {
  await page.clock.setFixedTime(new Date(AGORA));
  const { tocar } = await cadastrarCenario(page, 'Dani Exclusao', 1);
  const pasta = pastaEvidencias('excluir-metas');
  // Viewport do iPhone (o que ela vê), sem os toasts por cima.
  const shot = (nome: string) =>
    page.screenshot({ path: path.join(pasta, nome), animations: 'disabled', style: '.z-toast { display: none !important; }' });
  const hoje = page.getByTestId('saldo-hoje-valor');
  const confirmar = async (titulo: string, print?: string) => {
    const dialog = page.getByRole('dialog', { name: titulo, exact: true });
    await expect(dialog).toContainText('Excluir? Isso não pode ser desfeito.');
    await expect(dialog.getByRole('button', { name: 'Cancelar' })).toBeVisible();
    if (print) await shot(print);
    await dialog.getByRole('button', { name: 'Excluir', exact: true }).click();
    await expect(dialog).toBeHidden();
  };
  const acao = async (nome: RegExp) => {
    await page.getByRole('navigation', { name: 'Navegação principal' }).getByRole('button', { name: 'Lançar' }).click();
    await page.getByRole('dialog', { name: 'O que aconteceu?' }).getByRole('button', { name: nome }).click();
    return page.getByRole('dialog');
  };
  const gastar = async (descricao: string) => {
    const folha = await acao(/Gastei/);
    await folha.getByLabel('Valor', { exact: true }).fill('2500');
    await tocar(folha.getByRole('radio', { name: 'Comida' }));
    await folha.getByRole('radiogroup', { name: 'Saiu de' }).getByRole('radio', { name: 'Nubank' }).click();
    await folha.getByLabel(/descrição/i).fill(descricao);
    await folha.getByRole('button', { name: 'Salvar gasto' }).click();
    await expect(folha).toBeHidden();
  };
  const transferir = async () => {
    const folha = await acao(/Transferir/);
    await folha.getByLabel('Valor', { exact: true }).fill('10000');
    await folha.getByRole('radiogroup', { name: 'De', exact: true }).getByRole('radio', { name: 'Nubank' }).click();
    await folha.getByRole('radiogroup', { name: 'Para', exact: true }).getByRole('radio', { name: 'Caixa' }).click();
    await folha.getByRole('button', { name: 'Transferir', exact: true }).click();
    await expect(folha).toBeHidden();
  };
  await expect(page.getByRole('region', { name: 'Cofrinho' })).toBeVisible();
  await expect(page.getByText('Em 7 dias você terá')).toHaveCount(0);
  await expect(hoje).toHaveText(brl('285,00'));
  await shot('01-inicio-cofrinho.png');
  await gastar('Lanche');
  await expect(hoje).toHaveText(brl('260,00'));
  await tocar(page.getByRole('button', { name: 'Excluir lançamento Lanche', exact: true }));
  await expect(hoje).toHaveText(brl('260,00'));
  await confirmar('Excluir lançamento', '02-confirmar-excluir-gasto.png');
  await expect(hoje).toHaveText(brl('285,00'));
  await expect(page.getByRole('button', { name: 'Excluir lançamento Lanche', exact: true })).toHaveCount(0);

  await tocar(page.getByRole('button', { name: 'Paguei Internet' }));
  await expect(hoje).toHaveText(brl('175,00'));
  await tocar(page.getByRole('button', { name: 'Excluir lançamento Internet', exact: true }));
  await expect(page.getByRole('dialog', { name: 'Excluir lançamento' })).toContainText('a conta volta a ficar a pagar');
  await confirmar('Excluir lançamento');
  await expect(page.getByRole('button', { name: 'Paguei Internet' })).toBeVisible();
  await expect(hoje).toHaveText(brl('285,00'));

  await transferir();
  await page.goto('/financas/carteiras');
  await tocar(page.getByRole('button', { name: /^Excluir transferência/ }));
  await confirmar('Excluir transferência');
  await expect(page.getByRole('button', { name: /^Excluir transferência/ })).toHaveCount(0);
  await expect(page.getByRole('listitem').filter({ hasText: 'Caixa' })).toContainText(/R\$\s50,00/);
  await page.goto('/financas');
  await gastar('Compra preservada');
  await transferir();
  await page.goto('/financas/carteiras');
  const caixa = page.getByRole('listitem').filter({ has: page.getByRole('button', { name: 'Excluir Caixa', exact: true }) });
  await expect(caixa).toContainText(/R\$\s150,00/);
  await tocar(page.getByRole('button', { name: 'Excluir Nubank', exact: true }));
  await confirmar('Excluir banco', '03-confirmar-excluir-banco.png');
  await expect(caixa).toContainText(/R\$\s150,00/);
  await expect(page.getByRole('button', { name: 'Excluir Nubank', exact: true })).toHaveCount(0);
  await page.goto('/financas');
  await expect(page.getByRole('listitem').filter({ hasText: 'Compra preservada' })).toContainText('Sem banco');
  // Remove o gasto preservado para restaurar a sobra do exemplo: 2.200 − 110 = 2.090.
  await tocar(page.getByRole('button', { name: 'Excluir lançamento Compra preservada', exact: true }));
  await confirmar('Excluir lançamento');
  await page.goto('/financas/metas');
  await expect(page.getByTestId('metas-sobra')).toHaveText(brl('2.090,00'));
  await page.getByRole('button', { name: 'Nova meta', exact: true }).click();
  const nova = page.getByRole('dialog', { name: 'Nova meta' });
  await nova.getByLabel('Nome', { exact: true }).fill('Videogame');
  await nova.getByLabel('Quanto custa').fill('300000');
  await nova.getByLabel('Até quando (opcional)').fill('2027-01-31');
  await nova.getByRole('radio', { name: 'Videogame' }).click();
  await shot('05-metas-nova.png');
  await nova.getByRole('button', { name: 'Salvar meta' }).click();
  await expect(nova).toBeHidden();
  const meta = page.getByRole('listitem', { name: 'Videogame' });
  await expect(meta).toContainText(/Guarde R\$\s1\.000,00 por mês e em janeiro de 2027 você compra/);
  await shot('06-metas-sugestao-videogame.png');
  await meta.getByRole('button', { name: 'Guardei em Videogame' }).click();
  const guardei = page.getByRole('dialog', { name: 'Guardei', exact: true });
  await guardei.getByLabel('Quanto guardou agora').fill('50000');
  await guardei.getByRole('button', { name: 'Salvar', exact: true }).click();
  await expect(guardei).toBeHidden();
  await expect(meta).toContainText(/Guardado R\$\s500,00 de R\$\s3\.000,00 · 16%/);
  await expect(meta).toContainText(/Faltam R\$\s2\.500,00/);
  await expect(meta.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '16');
  await shot('04-metas-lista.png');
  await meta.getByRole('button', { name: 'Excluir meta Videogame' }).click();
  await expect(meta).toBeVisible();
  await confirmar('Excluir meta');
  await expect(meta).toHaveCount(0);
});
