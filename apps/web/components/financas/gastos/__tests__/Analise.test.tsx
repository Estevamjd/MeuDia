// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { montarAnalise, type ResumoAnalise } from '../montarAnalise';
import { AnaliseMes } from '../AnaliseMes';

vi.mock('next/dynamic', () => ({ default: () => () => null }));
afterEach(cleanup);
const texto = () => (document.body.textContent ?? '').replace(/\s/g, ' ');

// Cenário do print de 18/10 (DIAG-CARD-ENTROU): salário 943 sem Recebi, Pix 150, gastos 574, contas 844, começou em outubro.
const print: ResumoAnalise = {
  rendaPrevista: 943, rendaDoMes: 1093, gastoReal: 574,
  entradas: { salarioRecebido: 0, salarioPrevisto: 943, extras: 150, total: 150 },
  contasMes: 844, contasPagas: 0, contasFaltam: 844, pctComprometida: 844 / 943, pagasNoPrazo: null, vsMesAnterior: null,
};

describe('montarAnalise', () => {
  it('comparação com o mês anterior: null sem dados; texto quando tem', () => {
    expect(montarAnalise(print, '2026-10').comparacao).toBeNull();
    const com = montarAnalise({ ...print, vsMesAnterior: { gastoReal: { absoluto: 100, percentual: 0.2 } } }, '2026-10');
    expect(com.comparacao?.texto.replace(/\s/g, ' ')).toBe('Saiu R$ 100,00 a mais que em setembro');
    expect(com.comparacao?.aumentou).toBe(true);
  });

  it('percentuais com a base: renda do mês (salário + extras) e contas fixas ÷ salário', () => {
    const a = montarAnalise(print, '2026-10');
    expect(a.pctRendaUsada).toBeCloseTo(574 / 1093);
    expect(a.pctContasFixas).toBeCloseTo(844 / 943);
  });
});

describe('AnaliseMes (cenário do print)', () => {
  const props = { analise: montarAnalise(print, '2026-10'), fatias: [], evolucao: [], escondido: false };

  it('Entrou: "Salário" recebido R$ 0,00 de R$ 943,00 e "Extras" R$ 150,00 em linhas separadas', () => {
    render(<AnaliseMes {...props} />);
    expect(texto()).toContain('Salário recebido R$ 0,00 de R$ 943,00');
    expect(texto()).toContain('Extras R$ 150,00');
    expect(texto()).not.toContain('previstos');
  });

  it('Saiu: gasto + contas do mês (pagas e faltam), sem "previsto do Saiu"', () => {
    render(<AnaliseMes {...props} />);
    expect(texto()).toContain('Saiu R$ 574,00');
    expect(texto()).toContain('Contas do mês R$ 844,00 (pagas R$ 0,00, faltam R$ 844,00)');
  });

  it('uma sobra só: nada de "Sobra do mês"/"Prevista"; primeiro mês sem comparação falsa', () => {
    render(<AnaliseMes {...props} />);
    expect(texto()).not.toMatch(/Sobra do mês|Prevista|a mais que em setembro/);
    expect(texto()).toContain('Primeiro mês no app');
  });

  it('percentuais com a base escrita; pagas em dia sem elegíveis = "—"', () => {
    render(<AnaliseMes {...props} />);
    expect(texto()).toContain('Usou 53% da renda do mês (salário + extras)');
    expect(texto()).toContain('Contas fixas: 90% do salário');
    expect(texto()).toContain('Pagas em dia —');
  });
});
