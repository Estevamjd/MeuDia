// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useCorrigirSaldo } from '../useCarteiras';
const m = vi.hoisted(() => ({ corrigir: vi.fn() }));
vi.mock('@meudia/api', () => ({ carteirasService: { corrigirSaldo: m.corrigir } }));
vi.mock('../useAuth', () => ({ useAuth: () => ({ user: { id: 'u' } }) }));
afterEach(cleanup);
it('retry reutiliza UUID; próxima tentativa recebe outro UUID', async () => {
  const cliente = new QueryClient({ defaultOptions: { mutations: { retry: 1, retryDelay: 0 } } });
  const { result } = renderHook(() => useCorrigirSaldo('2026-10-17'), { wrapper: ({ children }) => <QueryClientProvider client={cliente}>{children}</QueryClientProvider> });
  m.corrigir.mockRejectedValueOnce(new Error('resposta perdida')).mockResolvedValue(null);
  await act(async () => { await result.current.mutateAsync({ carteira_id: 'c', saldo_real: 80 }); });
  expect(m.corrigir).toHaveBeenCalledTimes(2);
  const chave = m.corrigir.mock.calls[0]![3];
  expect(chave).toMatch(/^[0-9a-f-]{36}$/);
  expect(m.corrigir.mock.calls[1]![3]).toBe(chave);
  await act(async () => { await result.current.mutateAsync({ carteira_id: 'c', saldo_real: 90 }); });
  expect(m.corrigir.mock.calls[2]![3]).not.toBe(chave);
});
