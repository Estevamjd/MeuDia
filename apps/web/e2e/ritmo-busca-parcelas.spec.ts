import type { Locator, Page } from '@playwright/test';
import { test, expect } from './mock-guard';
import { vigiarErros } from './vigia-erros';

/**
 * Wave 3A (front), iPhone 13 WebKit contra o mock do Supabase, em 390 e 360px, no claro e no escuro:
 * (a) Início: cartão 2 "Ritmo" com o disponível por dia e "+ Guardei" no cartão Meta;
 * (b) Gastos: busca e "Só WhatsApp" na URL, vazio com "Limpar filtros";
 * (c) Parcelado no cartão: 3× no Gastei, "1/3" neste mês e "2/3" no próximo, excluir "esta e as próximas".
 * Relógio fixo em 18/10/2026 12:00 (SP): faltam 14 dias contando hoje.
 */

const MOCK_URL = 'http://127.0.0.1:54329';
const AGORA = '2026-10-18T15:00:00.000Z';
const SENHA = 'senhaForte123';
const run = Date.now().toString(36);
const brl = (valor: string) => new RegExp(`^R\\$\\s${valor.replace('.', '\\.')}$`);
const LARGURAS = [390, 360] as const;
const MODOS = ['Escuro', 'Claro'] as const;

test.describe.configure({ mode: 'serial' });
const relogio = (now: string | null) =>
  fetch(`${MOCK_URL}/__mock/clock`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ now }) });
test.beforeAll(() => relogio(AGORA));
test.afterAll(() => relogio(null));

async function cadastrar(page: Page, nome: string) {
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
  await page.getByLabel('Banco ou carteira 1').fill('Nubank');
  await page.getByLabel('Quanto tem hoje (1)').fill('30000');
  await page.getByRole('button', { name: 'Concluir' }).click();
  await page.waitForURL(/\/financas$/);
  return email;
}

async function semear(email: string, tables: Record<string, Record<string, unknown>[]>) {
  const res = await fetch(`${MOCK_URL}/__mock/seed`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, tables }) });
  expect(res.status, await res.clone().text()).toBe(200);
}

async function fecharBanner(page: Page) {
  const banner = page.getByText('Instalar MeuDia').locator('xpath=ancestor::div[contains(@class,"fixed")][1]');
  await banner.waitFor({ timeout: 5000 }).catch(() => {});
  if (await banner.isVisible().catch(() => false)) await banner.getByRole('button', { name: 'Fechar' }).click();
}

async function escolherModo(page: Page, nome: 'Claro' | 'Escuro') {
  await page.goto('/configuracoes');
  await page.getByRole('radiogroup', { name: 'Aparência' }).getByRole('radio', { name: nome }).click();
  await expect.poll(() => page.evaluate(() => document.documentElement.dataset.mode)).toBe(nome === 'Claro' ? 'light' : 'dark');
}

const semRolagemLateral = async (page: Page) =>
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);

/** Texto inteiro: nem o elemento nem nada dentro dele cortado (scrollWidth > clientWidth) nem com "…". */
async function semReticencias(alvo: Locator, rotulo: string) {
  const cortes = await alvo.evaluate((el) => {
    const todos = [el, ...Array.from(el.querySelectorAll<HTMLElement>('*'))] as HTMLElement[];
    return todos
      // .sr-only (1px, só leitor de tela) não é texto visível.
      .filter((n) => !n.classList.contains('sr-only') && n.clientWidth > 1 && n.scrollWidth > n.clientWidth + 1 && getComputedStyle(n).overflowX !== 'visible')
      .map((n) => `${n.tagName}.${n.className}: "${n.textContent}"`)
      .concat((el.textContent ?? '').includes('…') ? ['texto com …'] : []);
  });
  expect(cortes, `${rotulo} cortado`).toEqual([]);
}

/** O cartão está na frente do maço (marcado e assentado no centro). */
const naFrente = async (page: Page, testid: string) => {
  const c = page.getByTestId(testid);
  await expect(c).toHaveClass(/cartao-frente/);
  await expect
    .poll(async () => {
      const b = await c.boundingBox();
      return !!b && Math.abs(b.x + b.width / 2 - page.viewportSize()!.width / 2) < 2;
    })
    .toBe(true);
};

test('(a) Início: cartão "Ritmo" com o disponível por dia e "+ Guardei" no cartão Meta, em 390/360, claro e escuro', async ({ page }) => {
  const vigia = await vigiarErros(page);
  const email = await cadastrar(page, 'Lia Ritmo');
  // Renda 943 − contas 744 − gastos 59,90 = deve sobrar 139,10; 18 a 31/10 = 14 dias → R$ 9,93 por dia.
  await semear(email, {
    rendas: [{ descricao: 'Salário', valor: 943, dia_recebimento: 5 }],
    contas_pagar: [
      { descricao: 'Curso', categoria: 'Educação', valor: 620, recorrencia: 'mensal', dia_vencimento: 5 },
      { descricao: 'Celular', categoria: 'Outros', valor: 124, recorrencia: 'mensal', dia_vencimento: 25 },
    ],
    transacoes: [{ tipo: 'despesa', descricao: 'Mercado', categoria: 'Mercado', valor: 59.9, data: '2026-10-12', created_at: '2026-10-12T12:00:00.000Z' }],
    metas: [{ nome: 'Celular novo', icone: 'smartphone', valor_alvo: 2000, valor_guardado: 840, data_limite: '2027-03-31', criado_em: '2026-09-01T12:00:00.000Z' }],
  });

  for (const modo of MODOS) {
    await escolherModo(page, modo);
    for (const largura of LARGURAS) {
      await page.setViewportSize({ width: largura, height: 664 });
      await page.goto('/financas');
      await fecharBanner(page);
      await naFrente(page, 'cartao-pagina-resumo');
      await page.getByRole('button', { name: 'Próximo cartão: Ritmo' }).click();
      await naFrente(page, 'cartao-pagina-conta');
      const conta = page.getByTestId('cartao-pagina-conta');
      await expect(conta.getByText('Disponível por dia')).toBeVisible();
      await expect(page.getByTestId('cartao-ritmo-dia')).toHaveText(brl('9,93'));
      await expect(page.getByTestId('cartao-ritmo-dias')).toHaveText('14 dias restantes');
      await expect(page.getByTestId('previsao-fim-mes-valor')).toHaveText(brl('139,10'));
      // O conteúdo cabe no cartão (nada vaza por baixo) e os textos novos não cortam.
      const cc = (await conta.locator('.cartao-cc').boundingBox())!;
      const fim = (await page.getByTestId('previsao-fim-mes-valor').boundingBox())!;
      expect(fim.y + fim.height, `${modo} ${largura}: conta dentro do cartão`).toBeLessThanOrEqual(cc.y + cc.height);
      for (const id of ['cartao-ritmo-dia', 'cartao-ritmo-dias', 'resumo-mes-conta']) await semReticencias(page.getByTestId(id), `${modo} ${largura} ${id}`);
      // Contas fixas continuam abrindo a lista abaixo do maço.
      await conta.getByRole('button', { name: /Contas fixas/ }).click();
      await expect(page.getByRole('list', { name: 'Contas fixas de outubro' })).toContainText('Curso');
      await conta.getByRole('button', { name: /Contas fixas/ }).click();

      await page.getByRole('button', { name: 'Próximo cartão: Meta' }).click();
      await naFrente(page, 'cartao-pagina-meta');
      const botao = page.getByTestId('cartao-meta-btn-guardei');
      await expect(botao).toBeVisible();
      const b = (await botao.boundingBox())!;
      expect(b.height).toBeGreaterThanOrEqual(44);
      expect(b.width).toBeGreaterThanOrEqual(44);
      await semReticencias(botao, `${modo} ${largura} + Guardei`);
      await semReticencias(page.getByTestId('cartao-meta-valores'), `${modo} ${largura} valores da meta`);
      await semRolagemLateral(page);
    }
  }

  // "+ Guardei": abre o FormGuardei da meta do cartão, soma e o cartão atualiza (sem sair da Início).
  const botao = page.getByTestId('cartao-meta-btn-guardei');
  await botao.click();
  const dialogo = page.getByRole('dialog', { name: 'Guardei' });
  await expect(dialogo).toContainText('Em Celular novo você já guardou');
  // O toque no botão não passou o cartão.
  await expect(page.getByTestId('cartao-pagina-meta')).toHaveClass(/cartao-frente/);
  await dialogo.getByLabel('Quanto guardou agora').fill('5000');
  await dialogo.getByRole('button', { name: 'Salvar' }).click();
  await expect(dialogo).toHaveCount(0);
  await expect(page.getByText('Guardado!')).toBeVisible();
  await expect(page.getByTestId('cartao-meta-valores')).toHaveText(/R\$\s890,00 guardados de R\$\s2\.000,00/);
  await expect(page).toHaveURL(/\/financas$/);

  // "+ Guardei" deixa a página rolar na vertical (pan-y) e não o maço na horizontal, nos dois caminhos do maço: o
  // padrão deste WebKit e a reserva forçada (CSS.supports sem "timeline", como iOS < 26). Nenhum ancestral até o
  // documento corta o pan-y (touch-action efetivo = interseção da cadeia).
  const touchDoGuardei = (p: Page) =>
    p.getByTestId('cartao-meta-btn-guardei').evaluate((el) => {
      const cadeia: string[] = [];
      for (let n: HTMLElement | null = el.parentElement; n; n = n.parentElement) cadeia.push(getComputedStyle(n).touchAction);
      return { botao: getComputedStyle(el).touchAction, cortaPanY: cadeia.filter((t) => !/auto|manipulation|pan-y/.test(t)) };
    });
  const modoPadrao = await page.getByTestId('cartao-maco').getAttribute('data-maco');
  expect(await touchDoGuardei(page), `maço ${modoPadrao}`).toEqual({ botao: 'pan-y', cortaPanY: [] });
  const reserva = await page.context().newPage();
  await reserva.addInitScript(() => {
    const original = CSS.supports.bind(CSS) as (...a: string[]) => boolean;
    CSS.supports = ((...args: string[]) => (args.join(' ').includes('timeline') ? false : original(...args))) as typeof CSS.supports;
  });
  await reserva.clock.setFixedTime(new Date(AGORA));
  await reserva.goto('/financas');
  await expect(reserva.getByTestId('cartao-maco')).toHaveAttribute('data-maco', 'reserva');
  await reserva.getByTestId('cartao-meta-btn-guardei').waitFor({ state: 'attached' });
  expect(await touchDoGuardei(reserva), 'maço reserva').toEqual({ botao: 'pan-y', cortaPanY: [] });
  await reserva.close();
  expect(vigia.erros(), vigia.relatorio()).toEqual([]);
});

test('(a2) Início sem renda: cartão "Ritmo" convida a cadastrar a renda, sem número por dia', async ({ page }) => {
  await cadastrar(page, 'Bia Sem Renda');
  await page.goto('/financas');
  await fecharBanner(page);
  // Usuária nova (com banco, sem renda): o maço aparece; o cartão 2 não inventa um valor por dia.
  await page.getByRole('button', { name: 'Próximo cartão: Ritmo' }).click();
  await naFrente(page, 'cartao-pagina-conta');
  await expect(page.getByTestId('cartao-ritmo-dia')).toHaveCount(0);
  const convite = page.getByTestId('cartao-ritmo-sem-renda');
  await expect(convite).toHaveText('Cadastre sua renda para ver quanto pode gastar por dia');
  for (const largura of LARGURAS) {
    await page.setViewportSize({ width: largura, height: 664 });
    await semReticencias(convite, `sem renda ${largura}`);
    await semRolagemLateral(page);
  }
  await convite.click();
  await page.waitForURL(/\/financas\/orcamento$/);
});

test('(b) Gastos: busca e "Só WhatsApp" na URL, só no mês escolhido; vazio com "Limpar filtros"; 390/360, claro e escuro', async ({ page }) => {
  const email = await cadastrar(page, 'Duda Busca');
  await semear(email, {
    transacoes: [
      { tipo: 'despesa', descricao: 'Pão de Açúcar', categoria: 'Mercado', valor: 120, data: '2026-10-15', created_at: '2026-10-15T12:00:00.000Z' },
      { tipo: 'despesa', descricao: 'Uber pro trabalho', categoria: 'Transporte', valor: 25, data: '2026-10-14', origem: 'whatsapp', created_at: '2026-10-14T12:00:00.000Z' },
      { tipo: 'despesa', descricao: 'Uber de setembro', categoria: 'Transporte', valor: 30, data: '2026-09-20', origem: 'whatsapp', created_at: '2026-09-20T12:00:00.000Z' },
    ],
  });
  const linhas = (page: Page) => page.getByRole('region', { name: 'Últimas despesas' }).getByRole('listitem');

  for (const modo of MODOS) {
    await escolherModo(page, modo);
    for (const largura of LARGURAS) {
      await page.setViewportSize({ width: largura, height: 664 });
      await page.goto('/financas/gastos');
      await fecharBanner(page);
      await expect(linhas(page)).toHaveCount(2);
      const campo = page.getByRole('searchbox', { name: 'Buscar gasto' });
      await campo.fill('pao de acucar');
      await expect(page).toHaveURL(/[?&]q=pao\+de\+acucar/);
      await expect(linhas(page)).toHaveCount(1);
      await expect(linhas(page).first()).toContainText('Pão de Açúcar');
      await expect(page.getByTestId('gastos-busca-escopo')).toHaveText('Buscando só em outubro.');

      await page.getByRole('button', { name: 'Limpar busca' }).click();
      await expect(page).not.toHaveURL(/q=/);
      const chip = page.getByRole('button', { name: 'Só WhatsApp' });
      await chip.click();
      await expect(page).toHaveURL(/origem=whatsapp/);
      await expect(chip).toHaveAttribute('aria-pressed', 'true');
      await expect(linhas(page)).toHaveCount(1);
      await expect(linhas(page).first()).toContainText('Uber pro trabalho');
      await expect(linhas(page).first().locator('[data-origem="whatsapp"]')).toBeVisible();
      for (const alvo of [chip, campo, page.getByTestId('gastos-busca-escopo')]) await semReticencias(alvo, `${modo} ${largura} filtros`);
      const caixaChip = (await chip.boundingBox())!;
      expect(caixaChip.height).toBeGreaterThanOrEqual(44);

      // Recarregar mantém os filtros (estão na URL).
      await page.reload();
      await expect(page.getByRole('button', { name: 'Só WhatsApp' })).toHaveAttribute('aria-pressed', 'true');
      // "Uber de setembro" é de outro mês: a busca não alcança.
      await page.getByRole('searchbox', { name: 'Buscar gasto' }).fill('setembro');
      const vazio = page.getByTestId('gastos-busca-vazia');
      await expect(vazio).toContainText('Nada com “setembro” pelo WhatsApp em outubro.');
      await semReticencias(vazio, `${modo} ${largura} vazio`);
      await semRolagemLateral(page);
      await vazio.getByRole('button', { name: 'Limpar filtros' }).click();
      await expect(page).toHaveURL(/\/financas\/gastos$/);
      await expect(page.getByRole('searchbox', { name: 'Buscar gasto' })).toHaveValue('');
      await expect(linhas(page)).toHaveCount(2);
    }
  }
});

test('(c) Parcelado no cartão: 3× no Gastei, 1/3 neste mês e 2/3 no próximo; excluir "esta e as próximas"; 390/360, claro e escuro', async ({ page }) => {
  const vigia = await vigiarErros(page);
  await cadastrar(page, 'Nina Parcela');
  await page.goto('/financas/gastos');
  await fecharBanner(page);

  // Compra de R$ 300,01 em 3× (1ª no dia da compra, as outras todo mês).
  await page.getByRole('button', { name: 'Gastei' }).click();
  const folha = page.getByRole('dialog', { name: 'Gastei' });
  await folha.getByLabel('Valor').fill('30001');
  await folha.getByRole('switch', { name: 'Parcelado no cartão' }).click();
  await folha.getByRole('button', { name: 'Mais uma parcela' }).click();
  await expect(folha.getByTestId('parcelas-previa')).toHaveText(/^3× de R\$\s100,00 \(1ª R\$\s100,01\)$/);
  await folha.getByLabel('Descrição (opcional)').fill('Fone');
  await folha.getByRole('button', { name: 'Salvar compra' }).click();
  await expect(folha).toHaveCount(0);

  const linha = (page: Page) => page.getByRole('region', { name: 'Últimas despesas' }).getByRole('listitem').filter({ hasText: 'Fone' });
  await expect(linha(page)).toHaveCount(1);
  await expect(linha(page).getByTestId('selo-parcela')).toHaveText('1/3');
  await expect(linha(page)).toContainText('100,01');

  // Selo e prévia inteiros em 390/360, claro e escuro.
  for (const modo of MODOS) {
    await escolherModo(page, modo);
    for (const largura of LARGURAS) {
      await page.setViewportSize({ width: largura, height: 664 });
      await page.goto('/financas/gastos');
      await fecharBanner(page);
      await semReticencias(linha(page).getByTestId('selo-parcela'), `${modo} ${largura} selo`);
      await page.getByRole('button', { name: 'Gastei' }).click();
      const f = page.getByRole('dialog', { name: 'Gastei' });
      await f.getByLabel('Valor').fill('123456');
      await f.getByRole('switch', { name: 'Parcelado no cartão' }).click();
      for (let i = 0; i < 10; i++) await f.getByRole('button', { name: 'Mais uma parcela' }).click();
      await expect(f.getByTestId('parcelas-previa')).toHaveText(/^12× de R\$\s102,88$/);
      await semReticencias(f.getByTestId('campo-parcelado'), `${modo} ${largura} parcelado`);
      await semRolagemLateral(page);
      await page.keyboard.press('Escape');
      await expect(f).toHaveCount(0);
    }
  }

  // Próximo mês: 2/3 de R$ 100,00.
  await page.setViewportSize({ width: 390, height: 664 });
  await page.getByRole('button', { name: 'Próximo mês' }).click();
  await expect(page).toHaveURL(/mes=2026-11/);
  await expect(linha(page).getByTestId('selo-parcela')).toHaveText('2/3');
  await expect(linha(page)).toContainText('100,00');

  // Excluir a 2/3: escolher "esta e as próximas" apaga 2 e 3; a 1/3 fica.
  await linha(page).getByRole('button', { name: 'Excluir lançamento Fone' }).click();
  const confirmar = page.getByRole('dialog', { name: 'Excluir lançamento' });
  await expect(confirmar).toContainText('É a parcela 2/3 de uma compra no cartão.');
  await expect(confirmar.getByRole('button', { name: 'Só esta parcela' })).toBeVisible();
  await confirmar.getByRole('button', { name: 'Esta e as próximas (2 a 3)' }).click();
  await expect(confirmar).toHaveCount(0);
  await expect(linha(page)).toHaveCount(0);
  await page.getByRole('button', { name: 'Próximo mês' }).click();
  await expect(page).toHaveURL(/mes=2026-12/);
  await expect(page.getByText('Nenhum gasto fora das contas fixas neste filtro.')).toBeVisible();
  await page.getByRole('button', { name: 'Mês anterior' }).click();
  await page.getByRole('button', { name: 'Mês anterior' }).click();
  await expect(page).not.toHaveURL(/mes=/);
  await expect(linha(page).getByTestId('selo-parcela')).toHaveText('1/3');
  expect(vigia.erros(), vigia.relatorio()).toEqual([]);
});
