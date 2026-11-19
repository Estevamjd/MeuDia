// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useCorrigirCofrinho, useFecharMesCofrinho, useMoverCofrinho } from '../useCofrinho';
const m = vi.hoisted(() => ({ mover: vi.fn(), corrigir: vi.fn(), fechar: vi.fn() }));
vi.mock('@meudia/api', () => ({ cofrinhoService: { moverCofrinho: m.mover, corrigirCofrinho: m.corrigir, fecharMesCofrinho: m.fechar } }));
vi.mock('../useAuth', () => ({ useAuth: () => ({ user: { id: 'u' } }) }));
afterEach(cleanup);
const wrapper = (cliente: QueryClient) => ({ children }: { children: React.ReactNode }) => <QueryClientProvider client={cliente}>{children}</QueryClientProvider>;

it('Guardar: retry reutiliza a chave (não soma duas vezes); novo toque usa outra', async () => {
  const cliente = new QueryClient({ defaultOptions: { mutations: { retry: 1, retryDelay: 0 } } });
  const { result } = renderHook(() => useMoverCofrinho(), { wrapper: wrapper(cliente) });
  m.mover.mockRejectedValueOnce(new Error('resposta perdida')).mockResolvedValue(null);
  await act(async () => { await result.current.mutateAsync({ tipo: 'guardar', valor: 50 }); });
  expect(m.mover).toHaveBeenCalledTimes(2);
  expect(m.mover.mock.calls[0]!.slice(0, 2)).toEqual(['u', { tipo: 'guardar', valor: 50 }]);
  const chave = m.mover.mock.calls[0]![2];
  expect(chave).toMatch(/^[0-9a-f-]{36}$/);
  expect(m.mover.mock.calls[1]![2]).toBe(chave);
  await act(async () => { await result.current.mutateAsync({ tipo: 'tirar', valor: 10 }); });
  expect(m.mover.mock.calls[2]![2]).not.toBe(chave);
});

it('Corrigir e fechar mês repassam o valor', async () => {
  const cliente = new QueryClient();
  const corrigir = renderHook(() => useCorrigirCofrinho(), { wrapper: wrapper(cliente) });
  const fechar = renderHook(() => useFecharMesCofrinho(), { wrapper: wrapper(cliente) });
  m.corrigir.mockResolvedValue(null);
  m.fechar.mockResolvedValue({});
  await act(async () => { await corrigir.result.current.mutateAsync({ valor_real: 150 }); });
  expect(m.corrigir.mock.calls[0]!.slice(0, 2)).toEqual(['u', { valor_real: 150 }]);
  await act(async () => { await fechar.result.current.mutateAsync({ competencia: '2026-11', guardar: true, valor: 99 }); });
  expect(m.fechar).toHaveBeenCalledWith('u', { competencia: '2026-11', guardar: true, valor: 99 });
});
