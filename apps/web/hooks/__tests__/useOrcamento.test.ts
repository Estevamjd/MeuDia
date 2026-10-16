// @vitest-environment jsdom
import { cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import {
  useOrcamento,
  useSalvarOrcamento,
  useExcluirOrcamento,
  useCriarRenda,
  useResumoFinanceiroMes,
} from '../useOrcamento';

const mocks = vi.hoisted(() => ({
  user: { id: 'u1' } as { id: string } | null,
  invalidateQueries: vi.fn(),
  listarOrcamento: vi.fn(),
  salvarOrcamento: vi.fn(),
  excluirOrcamento: vi.fn(),
  criarRenda: vi.fn(),
  resumoFinanceiroMes: vi.fn(),
}));
vi.mock('../useAuth', () => ({ useAuth: () => ({ user: mocks.user }) }));
vi.mock('@meudia/api', () => ({
  orcamentoService: {
    listarOrcamento: mocks.listarOrcamento,
    salvarOrcamento: mocks.salvarOrcamento,
    excluirOrcamento: mocks.excluirOrcamento,
    criarRenda: mocks.criarRenda,
    resumoFinanceiroMes: mocks.resumoFinanceiroMes,
  },
}));
// Devolve as opções para inspecionar key, queryFn, mutationFn e onSuccess.
vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({ invalidateQueries: mocks.invalidateQueries }),
  useQuery: (options: unknown) => options,
  useMutation: (options: unknown) => options,
}));

interface QueryOpts { queryKey: unknown[]; queryFn: () => unknown; enabled: boolean }
interface MutationOpts<T> { mutationFn: (data: T) => unknown; onSuccess: () => void }

beforeEach(() => {
  vi.resetAllMocks();
  mocks.user = { id: 'u1' };
});
afterEach(() => cleanup());

const chavesInvalidadas = () => mocks.invalidateQueries.mock.calls.map(([arg]) => (arg as { queryKey: unknown[] }).queryKey);

it('useOrcamento: key com userId, busca do usuário logado', async () => {
  mocks.listarOrcamento.mockResolvedValue([]);
  const { result } = renderHook(() => useOrcamento() as unknown as QueryOpts);
  expect(result.current.queryKey).toEqual(['orcamento-categorias', 'u1']);
  expect(result.current.enabled).toBe(true);
  await result.current.queryFn();
  expect(mocks.listarOrcamento).toHaveBeenCalledWith('u1');
});

it('useOrcamento sem sessão fica desabilitado', () => {
  mocks.user = null;
  const { result } = renderHook(() => useOrcamento() as unknown as QueryOpts);
  expect(result.current.enabled).toBe(false);
});

it('useResumoFinanceiroMes: key inclui ano e mês', () => {
  const { result } = renderHook(() => useResumoFinanceiroMes(2026, 10) as unknown as QueryOpts);
  expect(result.current.queryKey).toEqual(['resumo-financeiro-mes', 'u1', 2026, 10]);
});

it('salvar limite chama o upsert do usuário e invalida orçamento, rendas e resumo', async () => {
  const { result } = renderHook(() => useSalvarOrcamento() as unknown as MutationOpts<{ categoria: string; valor_planejado: number }>);
  await result.current.mutationFn({ categoria: 'Mercado', valor_planejado: 500 });
  expect(mocks.salvarOrcamento).toHaveBeenCalledWith('u1', { categoria: 'Mercado', valor_planejado: 500 });
  result.current.onSuccess();
  expect(chavesInvalidadas()).toEqual([['rendas'], ['orcamento-categorias'], ['resumo-financeiro-mes']]);
});

it('excluir limite usa o id e invalida as mesmas chaves', async () => {
  const { result } = renderHook(() => useExcluirOrcamento() as unknown as MutationOpts<string>);
  await result.current.mutationFn('o1');
  expect(mocks.excluirOrcamento).toHaveBeenCalledWith('u1', 'o1');
  result.current.onSuccess();
  expect(chavesInvalidadas()).toContainEqual(['orcamento-categorias']);
  expect(chavesInvalidadas()).toContainEqual(['resumo-financeiro-mes']);
});

it('criar renda invalida o resumo (sobra prevista atualiza ao salvar)', () => {
  const { result } = renderHook(() => useCriarRenda() as unknown as MutationOpts<unknown>);
  result.current.onSuccess();
  expect(chavesInvalidadas()).toContainEqual(['rendas']);
  expect(chavesInvalidadas()).toContainEqual(['resumo-financeiro-mes']);
});

it('mutation sem sessão falha antes de chamar o serviço', () => {
  mocks.user = null;
  const { result } = renderHook(() => useSalvarOrcamento() as unknown as MutationOpts<{ categoria: string; valor_planejado: number }>);
  expect(() => result.current.mutationFn({ categoria: 'X', valor_planejado: 1 })).toThrow('Não autenticado');
  expect(mocks.salvarOrcamento).not.toHaveBeenCalled();
});
