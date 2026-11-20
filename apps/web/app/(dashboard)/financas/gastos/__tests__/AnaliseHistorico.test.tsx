// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import GastosPage from '../page';

const estado = (o: Record<string, unknown>) => ({ data: undefined, isLoading: false, isPending: false, isError: false, isSuccess: false, isFetching: false, refetch: vi.fn(), ...o });
const ok = <T,>(data: T) => estado({ data, isSuccess: true });

const { useHistoricoSaldoMes, usePainelSaldo } = vi.hoisted(() => ({ useHistoricoSaldoMes: vi.fn(), usePainelSaldo: vi.fn() }));

vi.mock('next/dynamic', () => ({ default: () => () => null }));
vi.mock('@meudia/shared', async (orig) => ({ ...(await orig<Record<string, unknown>>()), hojeSP: () => '2026-11-20' }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  useSearchParams: () => new URLSearchParams('aba=analise&mes=2026-11'),
}));
vi.mock('../../../../../hooks', () => ({
  useTransacoesMes: () => ok([]),
  useContasMes: () => ok([]),
  usePainelSaldo,
  useResumoFinanceiroMes: () =>
    ok({
      rendaPrevista: 943, rendaDoMes: 943, gastoReal: 0,
      entradas: { salarioRecebido: 0, salarioPrevisto: 943, extras: 0, total: 0 },
      contasMes: 0, contasPagas: 0, contasFaltam: 0, pctComprometida: 0, pagasNoPrazo: null, vsMesAnterior: null,
    }),
  useHistoricoSaldoMes,
}));
vi.mock('../../../../../components/financas/home/montarDashboard', () => ({ montarDashboard: () => ({ fatias: [], evolucao: [] }) }));
vi.mock('../../../../../components/financas/useExclusaoLancamento', () => ({
  useExclusaoLancamento: () => ({ vinculos: {}, bloqueadas: false, pedirExclusao: vi.fn(), exclusao: null }),
}));
vi.mock('../../../../../components/financas/LancamentoModais', () => ({
  useLancamentoModais: () => ({ abrirEdicao: vi.fn(), abrirNovo: vi.fn(), modais: null }),
}));
vi.mock('../../../../../components/financas/LancamentoRapidoSheet', () => ({ LancamentoRapidoSheet: () => null }));
vi.mock('../../../../../components/financas/ConfirmarExclusao', () => ({ ConfirmarExclusao: () => null }));
vi.mock('../../../../../components/financas/usePagamentoAcoes', () => ({ usePagamentoAcoes: () => ({ desfazerPagamento: vi.fn(), contaOcupada: null }) }));

const VAZIO = /O gráfico aparece com o primeiro gasto/;

beforeEach(() => {
  useHistoricoSaldoMes.mockReset();
  usePainelSaldo.mockReset();
  usePainelSaldo.mockReturnValue(ok({ painel: 'fake' }));
});
afterEach(cleanup);

describe('Gastos › Análise: linha de saldo depende do histórico do mês', () => {
  it('histórico pendente: indica carregando no gráfico e não afirma falta de dados', () => {
    useHistoricoSaldoMes.mockReturnValue(estado({ isPending: true, isLoading: true }));
    render(<GastosPage />);
    expect(screen.getByRole('status', { name: 'Carregando a evolução do saldo' })).toBeTruthy();
    expect(screen.queryByText(VAZIO)).toBeNull();
    expect(screen.queryByText('Não foi possível carregar a evolução do saldo.')).toBeNull();
  });

  it('histórico rejeitado: mensagem curta e "Tentar de novo" (≥ 44px) chama refetch', () => {
    const refetch = vi.fn();
    useHistoricoSaldoMes.mockReturnValue(estado({ isError: true, refetch }));
    render(<GastosPage />);
    expect(screen.getByRole('alert').textContent).toContain('Não foi possível carregar a evolução do saldo.');
    expect(screen.queryByText(VAZIO)).toBeNull();
    const botao = screen.getByRole('button', { name: 'Tentar de novo' });
    expect(botao.className).toContain('min-h-[44px]');
    fireEvent.click(botao);
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it('histórico carregado sem dados: aí sim mostra o aviso de gráfico vazio', () => {
    useHistoricoSaldoMes.mockReturnValue(ok({ saldos: [], transferencias: [] }));
    render(<GastosPage />);
    expect(screen.getByText(VAZIO)).toBeTruthy();
    expect(screen.queryByRole('status', { name: 'Carregando a evolução do saldo' })).toBeNull();
  });

  it('resumo e histórico ok, painel rejeitado sem dados: erro e "Tentar de novo" refaz o painel (não o histórico ok)', () => {
    const refetchPainel = vi.fn();
    const refetchHistorico = vi.fn();
    usePainelSaldo.mockReturnValue(estado({ isError: true, refetch: refetchPainel }));
    useHistoricoSaldoMes.mockReturnValue({ ...ok({ saldos: [], transferencias: [] }), refetch: refetchHistorico });
    render(<GastosPage />);
    expect(screen.getByRole('alert').textContent).toContain('Não foi possível carregar a evolução do saldo.');
    expect(screen.queryByText(VAZIO)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }));
    expect(refetchPainel).toHaveBeenCalledTimes(1);
    expect(refetchHistorico).not.toHaveBeenCalled();
  });

  it('painel e histórico rejeitados: "Tentar de novo" refaz os dois', () => {
    const refetchPainel = vi.fn();
    const refetchHistorico = vi.fn();
    usePainelSaldo.mockReturnValue(estado({ isError: true, refetch: refetchPainel }));
    useHistoricoSaldoMes.mockReturnValue(estado({ isError: true, refetch: refetchHistorico }));
    render(<GastosPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }));
    expect(refetchPainel).toHaveBeenCalledTimes(1);
    expect(refetchHistorico).toHaveBeenCalledTimes(1);
  });
});
