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

const resumoOk = {
  rendaPrevista: 5000, rendaReal: 5000, gastoReal: 2100, gastoPrevisto: 3200, sobraPrevista: 1800, sobraReal: 2900,
  pctComprometida: 0.64, pagasNoPrazo: 1, vsMesAnterior: { gastoReal: { absoluto: 0, percentual: null } }, selo: 'No controle',
};

const contaOcorrencia = { conta: { id: 'c1' }, competencia: '2026-10', vencimento: '2026-10-20', situacao: 'pendente', pagamento: null };

type NomeConsulta = 'resumo' | 'contas' | 'orcamento' | 'transacoes';
let q: Record<NomeConsulta | 'rendas', ReturnType<typeof consulta>>;
const preparar = (erros: Partial<Record<NomeConsulta, boolean>> = {}, dados: { rendas?: unknown[]; contas?: unknown[] } = {}) => {
  q = {
    resumo: consulta(resumoOk, { isError: !!erros.resumo }),
    contas: consulta(dados.contas ?? [], { isError: !!erros.contas }),
    orcamento: consulta([], { isError: !!erros.orcamento }),
    transacoes: consulta([], { isError: !!erros.transacoes }),
    rendas: consulta(dados.rendas ?? []),
  };
};

const m = vi.hoisted(() => ({
  push: { estado: 'inativo', ocupado: false, ativar: vi.fn(() => Promise.resolve()) },
  criarRenda: { mutate: vi.fn(), reset: vi.fn(), isPending: false, isError: false },
  toast: { error: vi.fn(), success: vi.fn() },
}));

vi.mock('../../../../hooks', () => ({
  useResumoFinanceiroMes: () => q.resumo,
  useContasMes: () => q.contas,
  useOrcamento: () => q.orcamento,
  useTransacoesMes: () => q.transacoes,
  useRendas: () => q.rendas,
  usePushLembretes: () => m.push,
  useCriarRenda: () => m.criarRenda,
}));
vi.mock('../../../ui', () => ({ useToast: () => m.toast }));
vi.mock('../../usePagamentoAcoes', () => ({ usePagamentoAcoes: () => ({ pagarConta: vi.fn(), contaOcupada: null }) }));

const DISPENSADO_KEY = 'meudia:aviso-lembretes-dispensado';

beforeEach(() => {
  vi.clearAllMocks();
  m.push.estado = 'inativo';
  m.criarRenda.isError = false;
  localStorage.clear();
});
afterEach(cleanup);

const acoes = { onNovo: vi.fn(), onEditar: vi.fn(), onExcluir: vi.fn() };
const montar = () => renderHook(() => useFinancasHome('2026-10', '2026-10-16', acoes)).result;
const usar = () => montar().current;

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

describe('useFinancasHome: onboarding', () => {
  it('sem renda: passo 1; com renda e sem contas: passo 2; com ambos: some', () => {
    preparar();
    expect(usar().boasVindas?.rendaCadastrada).toBe(false);
    preparar({}, { rendas: [{ id: 'r1', ativo: true }] });
    expect(usar().boasVindas?.rendaCadastrada).toBe(true);
    preparar({}, { rendas: [{ id: 'r1', ativo: true }], contas: [contaOcorrencia] });
    expect(usar().boasVindas).toBeNull();
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
    const { onSuccess } = m.criarRenda.mutate.mock.calls[0][1] as { onSuccess: () => void };
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

describe('useFinancasHome: aviso de lembretes', () => {
  it('sem contas não aparece', () => {
    preparar();
    expect(usar().avisoLembretes).toBeNull();
  });

  it('com contas e lembretes inativos aparece; "Ativar" usa a ação do push', () => {
    preparar({}, { contas: [contaOcorrencia] });
    const aviso = usar().avisoLembretes;
    expect(aviso).not.toBeNull();
    aviso?.onAtivar();
    expect(m.push.ativar).toHaveBeenCalled();
  });

  it('lembretes ativos: não aparece', () => {
    preparar({}, { contas: [contaOcorrencia] });
    m.push.estado = 'ativo';
    expect(usar().avisoLembretes).toBeNull();
  });

  it('dispensar esconde e grava no localStorage; dispensado antes não aparece', () => {
    preparar({}, { contas: [contaOcorrencia] });
    const r = montar();
    act(() => r.current.avisoLembretes?.onDispensar());
    expect(r.current.avisoLembretes).toBeNull();
    expect(localStorage.getItem(DISPENSADO_KEY)).toBe('1');
    cleanup();
    expect(usar().avisoLembretes).toBeNull();
  });
});
