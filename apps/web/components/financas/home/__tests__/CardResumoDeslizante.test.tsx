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
const carteiras = [{ id: 'n', nome: 'Nubank', saldo: 212.4 }, { id: 'w', nome: 'Carteira', saldo: 30 }];
const meta: MetaDoCartao = {
  id: 'm1', nome: 'Celular novo', icone: 'smartphone', valor_alvo: 2000, valor_guardado: 840, data_limite: '2027-03-31', criado_em: '2026-09-01T12:00:00Z',
};
const base = { sobra, cofrinho: 150, carteiras, hojeISO: '2026-11-19' };

describe('CardResumoDeslizante (Início v4)', () => {
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

  it('página 1: deve sobrar, % com destino, Cofrinho (link para Bancos); página 2 mantém a conta e mostra os bancos', () => {
    render(<CardResumoDeslizante {...base} />);
    expect(t(screen.getByTestId('cartao-sobra-valor'))).toBe('R$ 139,10');
    expect(t(screen.getByTestId('cartao-pagina-resumo'))).toContain('85% da renda já tem destino');
    expect(t(screen.getByTestId('linha-cofrinho-valor'))).toBe('R$ 150,00');
    expect((screen.getByTestId('linha-cofrinho')).getAttribute('href')).toBe('/financas/carteiras');
    const conta = screen.getByTestId('cartao-pagina-conta');
    expect(t(within(conta).getByTestId('resumo-renda'))).toBe('R$ 943,00');
    expect(t(within(conta).getByTestId('previsao-fim-mes-valor'))).toBe('R$ 139,10');
    expect(t(within(conta).getByTestId('cartao-bancos-hoje'))).toContain('Nubank');
    expect(t(within(conta).getByTestId('cartao-bancos-hoje'))).toContain('R$ 212,40');
  });

  it('com meta: 3 páginas, linha da meta na página 1 e a página Meta com %, valores, falta, hoje, ritmo e por mês', () => {
    render(<CardResumoDeslizante {...base} metas={[meta]} />);
    expect((screen.getByTestId('cartao-resumo')).getAttribute('data-paginas')).toBe('3');
    expect(t(screen.getByTestId('cartao-meta-mini'))).toContain('Celular novo');
    expect(t(screen.getByTestId('cartao-meta-mini'))).toContain('42%');
    expect(t(screen.getByTestId('cartao-meta-pct'))).toBe('42%');
    expect(t(screen.getByTestId('cartao-meta-valores'))).toBe('R$ 840,00 guardados de R$ 2.000,00');
    expect(t(screen.getByTestId('cartao-meta-falta'))).toBe('Faltam R$ 1.160,00');
    expect(t(screen.getByTestId('cartao-meta-hoje'))).toBe('hoje 37%');
    expect(t(screen.getByTestId('cartao-meta-ritmo'))).toBe('à frente do ritmo');
    expect(t(screen.getByTestId('cartao-meta-guardar'))).toContain('R$ 290,00');
    expect(t(screen.getByTestId('cartao-meta-guardar'))).toContain('mais que a sobra do mês');
    expect((screen.getByRole('progressbar', { name: 'Meta Celular novo' })).getAttribute('aria-valuetext')).toBe('42% guardado; pelo ritmo, hoje seria 37%');
  });

  it('olho fechado esconde valores em todas as páginas (o % continua)', () => {
    render(<CardResumoDeslizante {...base} metas={[meta]} escondido />);
    expect(t(screen.getByTestId('cartao-sobra-valor'))).toBe('R$ •••••');
    expect(t(screen.getByTestId('linha-cofrinho-valor'))).toBe('R$ •••••');
    expect(t(screen.getByTestId('cartao-meta-valores'))).toBe('R$ ••••• guardados de R$ •••••');
    expect(t(screen.getByTestId('cartao-meta-pct'))).toBe('42%');
    expect(document.body.textContent).not.toMatch(/212,40|1\.160,00/);
  });

  it('botões substituem o deslizar (WCAG 2.5.1): "Ver a conta" vai à página 2 e anuncia; lá aparecem Resumo e Meta', () => {
    render(<CardResumoDeslizante {...base} metas={[meta]} />);
    const ver = screen.getByRole('button', { name: /Ver a conta/ });
    expect((ver).hasAttribute('aria-controls')).toBe(true);
    fireEvent.click(ver);
    expect(screen.getByText('Página 2 de 3: A conta')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Resumo/ })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Meta/ }));
    expect(screen.getByText('Página 3 de 3: Meta')).toBeTruthy();
    expect((screen.getByRole('link', { name: /Guardar/ })).getAttribute('href')).toBe('/financas/metas');
  });

  it('setas do teclado trocam de página', () => {
    render(<CardResumoDeslizante {...base} metas={[meta]} />);
    const trilho = screen.getByLabelText(/Páginas do resumo do mês/);
    fireEvent.keyDown(trilho, { key: 'ArrowRight' });
    expect(screen.getByText('Página 2 de 3: A conta')).toBeTruthy();
    fireEvent.keyDown(trilho, { key: 'ArrowLeft' });
    expect(screen.getByText('Página 1 de 3: Resumo')).toBeTruthy();
  });
});
