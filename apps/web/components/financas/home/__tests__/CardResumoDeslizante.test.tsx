// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import type { SobraDoMes } from '@meudia/shared';
import { CardResumoDeslizante, paginasDoCartao, type MetaDoCartao } from '../CardResumoDeslizante';

afterEach(cleanup);

const t = (el: HTMLElement) => (el.textContent ?? '').replace(/\s/g, ' ');

// Cenário da Lia (mockup v4): renda 943, contas fixas 744 (620 pagas), extras 59,90 → deve sobrar 139,10.
const sobra: SobraDoMes = {
  competencia: '2026-11', renda: { lancada: 943, aReceber: 0, total: 943 }, rendasAReceber: [], previsao: false,
  contasFixas: [
    { id: 'c', descricao: 'Curso', categoria: 'Educação', valor: 620, vencimento: '2026-11-05', paga: true, pagoEm: '2026-11-05' },
    { id: 'k', descricao: 'Celular', categoria: 'Outros', valor: 124, vencimento: '2026-11-25', paga: false, pagoEm: null },
  ],
  totalContasFixas: 744, totalContasPagas: 620, gastosExtras: 59.9, despesasLancadas: 679.9, contasAPagar: [], despesas: 803.9, valor: 139.1,
};
const meta: MetaDoCartao = {
  id: 'm1', nome: 'Celular novo', icone: 'smartphone', valor_alvo: 2000, valor_guardado: 840, data_limite: '2027-03-31', criado_em: '2026-09-01T12:00:00Z',
};
const base = { sobra, cofrinho: 150, hojeISO: '2026-11-19' };

describe('CardResumoDeslizante (Início v5, maço)', () => {
  it('páginas: Resumo e A conta; Meta só quando existe meta', () => {
    expect(paginasDoCartao(false).map((p) => p.titulo)).toEqual(['Resumo', 'A conta']);
    expect(paginasDoCartao(true).map((p) => p.titulo)).toEqual(['Resumo', 'A conta', 'Meta']);
  });

  it('sem meta: 2 páginas, sem linha nem página de meta', () => {
    render(<CardResumoDeslizante {...base} />);
    expect((screen.getByTestId('cartao-resumo')).getAttribute('data-paginas')).toBe('2');
    expect(screen.getAllByRole('group').map((g) => g.getAttribute('aria-label'))).toEqual(['1 de 2: Resumo', '2 de 2: A conta']);
    expect(screen.queryByTestId('cartao-meta-mini')).toBeNull();
    expect(screen.queryByTestId('cartao-pagina-meta')).toBeNull();
  });

  it('cartão 1: deve sobrar, % com destino, Cofrinho (link para Bancos); cartão 2 mantém a conta (Você recebe − Contas fixas − Gastos)', () => {
    render(<CardResumoDeslizante {...base} />);
    expect(t(screen.getByTestId('cartao-sobra-valor'))).toBe('R$ 139,10');
    expect(t(screen.getByTestId('cartao-pagina-resumo'))).toContain('85% da renda já tem destino');
    expect(t(screen.getByTestId('linha-cofrinho-valor'))).toBe('R$ 150,00');
    expect((screen.getByTestId('linha-cofrinho')).getAttribute('href')).toBe('/financas/carteiras');
    const conta = screen.getByTestId('cartao-pagina-conta');
    expect(t(within(conta).getByTestId('resumo-renda'))).toBe('R$ 943,00');
    expect(t(within(conta).getByTestId('previsao-fim-mes-valor'))).toBe('R$ 139,10');
    expect(t(within(conta).getByTestId('resumo-contas-fixas'))).toBe('− R$ 744,00');
    expect(t(within(conta).getByTestId('resumo-gastos'))).toBe('− R$ 59,90');
    expect(within(conta).getByRole('heading', { level: 2 }).textContent).toBe('A conta de novembro');
  });

  it('com meta: 3 páginas, linha da meta na página 1 e a página Meta com %, valores, falta, hoje, ritmo e por mês', () => {
    render(<CardResumoDeslizante {...base} metas={[meta]} />);
    expect((screen.getByTestId('cartao-resumo')).getAttribute('data-paginas')).toBe('3');
    expect(t(screen.getByTestId('cartao-meta-mini'))).toContain('Celular novo');
    expect(t(screen.getByTestId('cartao-meta-mini'))).toContain('42%');
    expect(t(screen.getByTestId('cartao-meta-pct'))).toBe('42%');
    expect(t(screen.getByTestId('cartao-meta-valores'))).toBe('R$ 840,00 guardados de R$ 2.000,00');
    expect(t(screen.getByTestId('cartao-meta-falta'))).toBe('FaltamR$ 1.160');
    expect(t(screen.getByTestId('cartao-meta-hoje'))).toBe('hoje 37%');
    expect(t(screen.getByTestId('cartao-meta-ritmo'))).toBe('à frente do ritmo');
    expect(t(screen.getByTestId('cartao-meta-guardar'))).toContain('R$ 290');
    expect(t(screen.getByTestId('cartao-meta-guardar'))).toContain('acima da sobra');
    expect(t(screen.getByTestId('cartao-pagina-meta'))).toContain('mar/27');
    expect((screen.getByRole('progressbar', { name: 'Meta Celular novo' })).getAttribute('aria-valuetext')).toBe('42% guardado; pelo ritmo, hoje seria 37%');
  });

  it('olho fechado esconde valores em todas as páginas (o % continua)', () => {
    render(<CardResumoDeslizante {...base} metas={[meta]} escondido />);
    expect(t(screen.getByTestId('cartao-sobra-valor'))).toBe('R$ •••••');
    expect(t(screen.getByTestId('linha-cofrinho-valor'))).toBe('R$ •••••');
    expect(t(screen.getByTestId('cartao-meta-valores'))).toBe('R$ ••••• guardados de R$ •••••');
    expect(t(screen.getByTestId('cartao-meta-pct'))).toBe('42%');
    expect(document.body.textContent).not.toMatch(/139,10|943,00|744,00|1\.160/);
  });

  it('botões ‹ › substituem o arrastar (WCAG 2.5.1): passam o cartão e anunciam; no último (Meta) vira "Guardar"', () => {
    render(<CardResumoDeslizante {...base} metas={[meta]} />);
    const anterior = screen.getByRole('button', { name: 'Cartão anterior' });
    expect((anterior as HTMLButtonElement).disabled).toBe(true);
    const proximo = screen.getByRole('button', { name: 'Próximo cartão: A conta' });
    expect(proximo.hasAttribute('aria-controls')).toBe(true);
    fireEvent.click(proximo);
    expect(screen.getByText('Cartão 2 de 3: A conta')).toBeTruthy();
    expect(t(screen.getByTestId('cartao-posicao'))).toBe('2 de 3 · A conta');
    expect(screen.getByRole('button', { name: 'Cartão anterior: Resumo' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Próximo cartão: Meta' }));
    expect(screen.getByText('Cartão 3 de 3: Meta')).toBeTruthy();
    expect(screen.getByRole('link', { name: /Guardar/ }).getAttribute('href')).toBe('/financas/metas');
  });

  it('só o cartão da frente recebe foco e toque (os de trás ficam inert) e ele é marcado como frente', () => {
    render(<CardResumoDeslizante {...base} metas={[meta]} />);
    const inert = (id: string) => (screen.getByTestId(id) as HTMLElement & { inert: boolean }).inert;
    expect([inert('cartao-pagina-resumo'), inert('cartao-pagina-conta'), inert('cartao-pagina-meta')]).toEqual([false, true, true]);
    expect(screen.getByTestId('cartao-pagina-resumo').className).toContain('cartao-frente');
    fireEvent.click(screen.getByRole('button', { name: 'Próximo cartão: A conta' }));
    expect([inert('cartao-pagina-resumo'), inert('cartao-pagina-conta'), inert('cartao-pagina-meta')]).toEqual([true, false, true]);
  });

  it('pose inicial do maço: o 1º na frente, os outros atrás à direita, menores e girados', () => {
    render(<CardResumoDeslizante {...base} metas={[meta]} />);
    const tr = (id: string) => (screen.getByTestId(id) as HTMLElement).style.transform;
    expect(tr('cartao-pagina-resumo')).toBe('translateX(0.00px) rotate(0.00deg) scale(1.0000)');
    expect(tr('cartao-pagina-conta')).toBe('translateX(13.00px) rotate(2.40deg) scale(0.9450)');
    expect(tr('cartao-pagina-meta')).toBe('translateX(26.00px) rotate(4.80deg) scale(0.8900)');
  });

  it('"Contas fixas" no cartão abre a lista abaixo do maço, com pago / a pagar', () => {
    render(<CardResumoDeslizante {...base} />);
    const botao = screen.getByRole('button', { name: /Contas fixas/ });
    expect(botao.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(botao);
    expect(botao.getAttribute('aria-expanded')).toBe('true');
    const lista = screen.getByRole('list', { name: 'Contas fixas de novembro' });
    expect(botao.getAttribute('aria-controls')).toBe(lista.id);
    expect(t(lista)).toContain('Curso');
    expect(t(lista)).toContain('pago');
    expect(t(screen.getByTestId('resumo-contas-fixas-status'))).toContain('1 paga · 1 a pagar');
  });

  it('setas do teclado passam os cartões', () => {
    render(<CardResumoDeslizante {...base} metas={[meta]} />);
    const trilho = screen.getByLabelText(/Cartões do resumo do mês/);
    fireEvent.keyDown(trilho, { key: 'ArrowRight' });
    expect(screen.getByText('Cartão 2 de 3: A conta')).toBeTruthy();
    fireEvent.keyDown(trilho, { key: 'ArrowLeft' });
    expect(screen.getByText('Cartão 1 de 3: Resumo')).toBeTruthy();
  });
});
