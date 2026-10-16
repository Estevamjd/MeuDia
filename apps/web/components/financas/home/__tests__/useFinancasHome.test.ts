// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, renderHook } from '@testing-library/react';
import { useFinancasHome } from '../useFinancasHome';

const consulta = (data: unknown, over: { isLoading?: boolean; isError?: boolean } = {}) => ({
  data: over.isError ? undefined : data,
  isLoading: false,
  isError: false,
  refetch: vi.fn(() => Promise.resolve()),
  ...over,
});

const resumoOk = {
  rendaPrevista: 5000, rendaReal: 5000, gastoReal: 2100, gastoPrevisto: 3200, sobraPrevista: 1800, sobraReal: 2900,
  pctComprometida: 0.64, pagasNoPrazo: 1, vsMesAnterior: { gastoReal: { absoluto: 0, percentual: null } }, selo: 'No controle',
};

let q: Record<'resumo' | 'contas' | 'orcamento' | 'transacoes', ReturnType<typeof consulta>>;
const preparar = (erros: Partial<Record<keyof typeof q, boolean>> = {}) => {
  q = {
    resumo: consulta(resumoOk, { isError: !!erros.resumo }),
    contas: consulta([], { isError: !!erros.contas }),
    orcamento: consulta([], { isError: !!erros.orcamento }),
    transacoes: consulta([], { isError: !!erros.transacoes }),
  };
};

vi.mock('../../../../hooks', () => ({
  useResumoFinanceiroMes: () => q.resumo,
  useContasMes: () => q.contas,
  useOrcamento: () => q.orcamento,
  useTransacoesMes: () => q.transacoes,
  useRendas: () => ({ data: [] }),
  usePushLembretes: () => ({ estado: 'inativo', ocupado: false, ativar: vi.fn() }),
}));
vi.mock('../../../ui', () => ({ useToast: () => ({ error: vi.fn() }) }));
vi.mock('../../usePagamentoAcoes', () => ({ usePagamentoAcoes: () => ({ pagarConta: vi.fn(), contaOcupada: null }) }));

afterEach(cleanup);

const acoes = { onNovo: vi.fn(), onEditar: vi.fn(), onExcluir: vi.fn() };
const usar = () => renderHook(() => useFinancasHome('2026-10', '2026-10-16', acoes)).result.current;

describe('useFinancasHome', () => {
  it('tudo ok: pronto', () => {
    preparar();
    expect(usar().estado).toBe('pronto');
  });

  it.each(['contas', 'orcamento', 'transacoes'] as const)('falha em %s vira erro (não lista vazia)', (nome) => {
    preparar({ [nome]: true });
    expect(usar().estado).toBe('erro');
  });

  it('"Tentar de novo" refaz todas as consultas que falharam', () => {
    preparar({ contas: true, transacoes: true });
    usar().onTentarDeNovo?.();
    expect(q.contas.refetch).toHaveBeenCalled();
    expect(q.transacoes.refetch).toHaveBeenCalled();
    expect(q.resumo.refetch).not.toHaveBeenCalled();
    expect(q.orcamento.refetch).not.toHaveBeenCalled();
  });

  it('falha no resumo: erro e refaz o resumo', () => {
    preparar({ resumo: true });
    const r = usar();
    expect(r.estado).toBe('erro');
    r.onTentarDeNovo?.();
    expect(q.resumo.refetch).toHaveBeenCalled();
  });
});
