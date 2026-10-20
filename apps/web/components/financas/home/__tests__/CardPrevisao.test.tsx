// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { SobraDoMes } from '@meudia/shared';
import { CardSobraMes } from '../CardPrevisao';

afterEach(cleanup);

/** Intl usa NBSP entre "R$" e o número. */
const texto = () => (document.body.textContent ?? '').replace(/\s/g, ' ');
const linha = (id: string) => screen.getByTestId(id).textContent?.replace(/\s/g, ' ');

describe('CardSobraMes: "Sobra até agora" × "No fim do mês sobra"', () => {
  // Renda 1.000, gastos lançados 381, Júlia 100 ainda sem "Paguei".
  const sobra: SobraDoMes = {
    competencia: '2026-10', renda: { lancada: 1000, aReceber: 0, total: 1000 }, rendasAReceber: [],
    despesasLancadas: 381, contasAPagar: [{ id: 'j', descricao: 'Júlia', categoria: 'Outros', valor: 100, vencimento: '2026-10-25' }],
    despesas: 481, valor: 519,
  };

  it('até agora não desconta a conta a pagar; fim do mês desconta e diz isso', () => {
    render(<CardSobraMes sobra={sobra} escondido={false} />);
    expect(texto()).toContain('Sobra até agora');
    expect(linha('sobra-ate-agora-valor')).toBe('R$ 619,00');
    expect(linha('previsao-fim-mes-valor')).toBe('R$ 519,00');
    expect(linha('previsao-fim-mes-conta')).toBe('Renda R$ 1.000,00 − gastos lançados R$ 381,00 − contas a pagar R$ 100,00 = sobra R$ 519,00');
    fireEvent.click(screen.getByRole('button', { name: 'por quê? No fim do mês sobra' }));
    expect(texto()).toContain('Sobra até agora = renda do mês − gastos já lançados (contas ainda não pagas não entram).');
    expect(texto()).toContain('No fim do mês sobra = desconta também as contas a pagar.');
    expect(texto()).toContain('− Júlia (vence 25/10)−R$ 100,00');
  });

  it('até agora negativo em vermelho; arredonda em centavos', () => {
    render(<CardSobraMes sobra={{ ...sobra, renda: { lancada: 0.3, aReceber: 0, total: 0.3 }, despesasLancadas: 0.6, despesas: 100.6, valor: -100.3 }} escondido={false} />);
    expect(linha('sobra-ate-agora-valor')).toBe('−R$ 0,30');
    expect(screen.getByTestId('sobra-ate-agora-valor').className).toContain('text-red');
  });

  it('centavos: 0,30 − (0,10 + 0,20) dá zero, sem sinal nem vermelho', () => {
    render(<CardSobraMes sobra={{ ...sobra, renda: { lancada: 0.3, aReceber: 0, total: 0.3 }, despesasLancadas: 0.1 + 0.2, despesas: 100.3, valor: -100 }} escondido={false} />);
    expect(linha('sobra-ate-agora-valor')).toBe('R$ 0,00');
    expect(screen.getByTestId('sobra-ate-agora-valor').className).not.toContain('text-red');
  });

  it('ocultar valores esconde também o "até agora", sem vermelho', () => {
    render(<CardSobraMes sobra={{ ...sobra, despesasLancadas: 2000, despesas: 2100, valor: -1100 }} escondido />);
    expect(texto()).not.toMatch(/R\$ \d/);
    expect(screen.getByTestId('sobra-ate-agora-valor').className).not.toContain('text-red');
  });
});
