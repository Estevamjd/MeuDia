// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook } from '@testing-library/react';
import { useFinancasHome } from '../useFinancasHome';

const consulta = (data: unknown, over: { isLoading?: boolean; isError?: boolean } = {}) => ({
  data: over.isError ? undefined : data,
  isLoading: false,
  isError: false,
  isSuccess: !over.isError,
  refetch: vi.fn(() => Promise.resolve()),
  ...over,
});

const resumoOk = { rendaPrevista: 5000, rendaReal: 5000 };

const contaCadastrada = { id: 'c1', ativo: true };

type NomeConsulta = 'resumo' | 'contas' | 'transacoes' | 'rendas' | 'definicoes';
let q: Record<NomeConsulta, ReturnType<typeof consulta>>;
const preparar = (
  erros: Partial<Record<NomeConsulta, boolean>> = {},
  dados: { rendas?: unknown[]; definicoes?: unknown[] } = {},
) => {
  q = {
    resumo: consulta(resumoOk, { isError: !!erros.resumo }),
    contas: consulta([], { isError: !!erros.contas }),
    transacoes: consulta([], { isError: !!erros.transacoes }),
    rendas: consulta(dados.rendas ?? [], { isError: !!erros.rendas }),
    definicoes: consulta(dados.definicoes ?? [], { isError: !!erros.definicoes }),
  };
};

const m = vi.hoisted(() => ({
  pagar: vi.fn(),
  painel: { data: undefined as unknown, isLoading: false, isError: false, error: null as unknown },
  criarRenda: { mutate: vi.fn(), reset: vi.fn(), isPending: false, isError: false },
  toast: { error: vi.fn(), success: vi.fn() },
}));

vi.mock('../../../../hooks', () => ({
  useResumoFinanceiroMes: () => q.resumo,
  useContas: () => q.definicoes,
  useContasMes: () => q.contas,
  useTransacoesMes: () => q.transacoes,
  useRendas: () => q.rendas,
  useCriarRenda: () => m.criarRenda,
  usePainelSaldo: () => m.painel,
  useReceberRenda: () => ({ mutate: vi.fn(), reset: vi.fn(), isPending: false }),
}));
vi.mock('../../../ui', () => ({ useToast: () => m.toast }));
vi.mock('../../usePagamentoAcoes', () => ({ usePagamentoAcoes: () => ({ pagarConta: m.pagar, desfazerPagamento: vi.fn(), contaOcupada: null }) }));

beforeEach(() => {
  vi.clearAllMocks();
  m.painel = { data: undefined, isLoading: false, isError: false, error: null };
  m.criarRenda.isError = false;
});
afterEach(cleanup);

const onGastei = vi.fn();
const montar = () => renderHook(() => useFinancasHome('2026-10', '2026-10-16', onGastei)).result;
const usar = () => montar().current;

describe('useFinancasHome', () => {
  it('tudo ok: pronto', () => {
    preparar();
    expect(usar().estado).toBe('pronto');
  });

  it.each(['contas', 'transacoes', 'rendas', 'definicoes'] as const)(
    'falha em %s vira erro (não lista vazia) e "Tentar de novo" refaz ela',
    (nome) => {
      preparar({ [nome]: true });
      const r = usar();
      expect(r.estado).toBe('erro');
      r.onTentarDeNovo?.();
      expect(q[nome].refetch).toHaveBeenCalled();
    },
  );

  it.each(['resumo', 'contas', 'rendas', 'definicoes'] as const)('%s carregando: carregando', (nome) => {
    preparar();
    q[nome] = { ...q[nome], data: undefined, isLoading: true, isSuccess: false };
    expect(usar().estado).toBe('carregando');
  });

  it('"Tentar de novo" refaz todas as consultas que falharam', () => {
    preparar({ contas: true, transacoes: true });
    usar().onTentarDeNovo?.();
    expect(q.contas.refetch).toHaveBeenCalled();
    expect(q.transacoes.refetch).toHaveBeenCalled();
    expect(q.resumo.refetch).not.toHaveBeenCalled();
  });

  it('falha no resumo: erro e refaz o resumo', () => {
    preparar({ resumo: true });
    const r = usar();
    expect(r.estado).toBe('erro');
    r.onTentarDeNovo?.();
    expect(q.resumo.refetch).toHaveBeenCalled();
  });
});

describe('useFinancasHome: onboarding', () => {
  it('sem renda: passo 1; com renda e sem contas: passo 2; com ambos: some', () => {
    preparar();
    expect(usar().boasVindas?.rendaCadastrada).toBe(false);
    preparar({}, { rendas: [{ id: 'r1', ativo: true }] });
    expect(usar().boasVindas?.rendaCadastrada).toBe(true);
    preparar({}, { rendas: [{ id: 'r1', ativo: true }], definicoes: [contaCadastrada] });
    expect(usar().boasVindas).toBeNull();
  });

  it('conta cadastrada sem ocorrência no mês (anual/avulsa) já conclui o passo 2; inativas não contam', () => {
    preparar({}, { rendas: [{ id: 'r1', ativo: true }], definicoes: [contaCadastrada] });
    expect(q.contas.data).toEqual([]);
    expect(usar().boasVindas).toBeNull();
    preparar({}, { rendas: [{ id: 'r1', ativo: true }], definicoes: [{ id: 'c2', ativo: false }] });
    expect(usar().boasVindas?.rendaCadastrada).toBe(true);
  });

  it('renda inativa não conta como cadastrada', () => {
    preparar({}, { rendas: [{ id: 'r1', ativo: false }], definicoes: [contaCadastrada] });
    expect(usar().boasVindas?.rendaCadastrada).toBe(false);
  });

  it('"Cadastrar minha renda" abre o sheet; salvar cria "Renda principal", fecha e mostra toast', () => {
    preparar();
    const r = montar();
    expect(r.current.rendaSheet.open).toBe(false);
    act(() => r.current.boasVindas?.onCadastrarRenda());
    expect(m.criarRenda.reset).toHaveBeenCalled();
    expect(r.current.rendaSheet.open).toBe(true);

    act(() => r.current.rendaSheet.onSalvar(4800, 5));
    expect(m.criarRenda.mutate).toHaveBeenCalledWith(
      { descricao: 'Renda principal', valor: 4800, dia_recebimento: 5 },
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    );
    const { onSuccess } = m.criarRenda.mutate.mock.calls[0]![1] as { onSuccess: () => void };
    act(() => onSuccess());
    expect(r.current.rendaSheet.open).toBe(false);
    expect(m.toast.success).toHaveBeenCalledWith('Renda salva');
  });

  it('erro ao salvar vira mensagem no sheet', () => {
    preparar();
    m.criarRenda.isError = true;
    expect(usar().rendaSheet.erro).toBe('Não foi possível salvar a renda. Tente de novo.');
  });
});

it.each(['carregando', 'erro'])('Paguei bloqueado com painel %s, inclusive chamada direta', (estado) => {
  preparar();
  m.painel.isLoading = estado === 'carregando';
  m.painel.isError = estado === 'erro';
  const home = usar();
  expect(home.pagamentoBloqueado).toBe(true);
  home.onPagar({ contaId: 'c', competencia: '2026-10', descricao: 'Luz', valor: 10, vencimento: '2026-10-17', situacao: 'pendente' });
  expect(m.pagar).not.toHaveBeenCalled();
});
it('schema desatualizado exibe mensagem amigável e mantém home', () => {
  preparar();
  m.painel.isError = true;
  m.painel.error = { code: 'SCHEMA_DESATUALIZADO' };
  const home = usar();
  expect(home.estado).toBe('pronto');
  expect(home.erroPainel).toContain('terminando uma atualização');
});
it.each([null, 'inexistente', 'segunda'])('Paguei usa sempre carteira ativa (padrão %s)', (padrao) => {
  preparar();
  m.painel.data = {
    carteiras: [{ carteira: { id: 'primeira', nome: 'Nubank' }, saldo: 100 }, { carteira: { id: 'segunda', nome: 'Caixa' }, saldo: 50 }],
    carteiraPadraoId: padrao,
    hojeISO: '2026-10-16', competencia: '2026-10', saldoHoje: 150, comecouMes: null,
    arquivadas: [], rendasAReceber: [], transacoesCarteiras: [], transferencias: [],
    mes: { rendas: [], recebimentos: [], contas: [], pagamentos: [] },
  };
  const home = usar();
  expect(home.pagamentoBloqueado).toBe(false);
  home.onPagar({ contaId: 'c', competencia: '2026-10', descricao: 'Luz', valor: 10, vencimento: '2026-10-17', situacao: 'pendente' });
  expect(m.pagar).toHaveBeenCalledWith(expect.anything(), { carteira_id: padrao === 'segunda' ? 'segunda' : 'primeira' });
});
it.each([['arquivada', 'primeira'], ['segunda', 'segunda'], [null, 'primeira']])(
  'Recebi abre com carteira ativa (carteira da renda %s → %s)', (daRenda, esperada) => {
    preparar();
    const item = { rendaId: 'r1', competencia: '2026-10', descricao: 'Salário', valor: 900, data: '2026-10-05' };
    m.painel.data = {
      carteiras: [{ carteira: { id: 'primeira', nome: 'Nubank' }, saldo: 100 }, { carteira: { id: 'segunda', nome: 'Caixa' }, saldo: 50 }],
      carteiraPadraoId: 'primeira',
      hojeISO: '2026-10-16', competencia: '2026-10', saldoHoje: 150, comecouMes: null,
      arquivadas: [{ id: 'arquivada', nome: 'Antiga', arquivada: true }],
      rendasAReceber: [{ renda: { id: 'r1', descricao: 'Salário', valor: 900, carteira_id: daRenda }, competencia: '2026-10', data: '2026-10-05' }],
      transacoesCarteiras: [], transferencias: [],
      mes: { rendas: [], recebimentos: [], contas: [], pagamentos: [] },
    };
    const result = montar();
    act(() => result.current.dashboard!.onRecebi(item as never));
    expect(result.current.dashboard!.recebiSheet.carteiraPadrao).toBe(esperada);
  });

