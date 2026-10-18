// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useAuth } from '../useAuth';
import { usePushLembretes } from '../usePushLembretes';
import { useCriarTransacao, useAtualizarTransacao, useExcluirTransacao } from '../useFinancas';

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(), signOut: vi.fn(), push: vi.fn(), invalidateQueries: vi.fn(),
  getSubscription: vi.fn(), unsubscribe: vi.fn(), fetch: vi.fn(),
  onAuthStateChange: vi.fn(),
}));
vi.mock('../../lib/supabase/client', () => ({ createClient: () => ({ auth: mocks }) }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: mocks.push }) }));
vi.mock('@meudia/api', () => ({ setSupabaseClient: vi.fn(), financasService: {} }));
vi.mock('../../components/AppModeProvider', () => ({ useVapidPublicKey: () => 'fixture' }));
vi.mock('../../lib/offline-mutation', () => ({ withOfflineSupport: vi.fn() }));
vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({ invalidateQueries: mocks.invalidateQueries }),
  useMutation: (options: unknown) => options,
}));
beforeEach(() => {
  vi.resetAllMocks();
  mocks.getUser.mockResolvedValue({ data: { user: { id: 'atual' } } });
  mocks.onAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } });
  mocks.getSubscription.mockResolvedValue({ endpoint: 'https://example.invalid/push', unsubscribe: mocks.unsubscribe });
  vi.stubGlobal('fetch', mocks.fetch);
  Object.defineProperty(navigator, 'serviceWorker', { configurable: true, value: {
    getRegistration: vi.fn().mockResolvedValue({ pushManager: { getSubscription: mocks.getSubscription } }),
  } });
  vi.stubGlobal('PushManager', function () {});
  vi.stubGlobal('Notification', { permission: 'granted' });
  vi.stubGlobal('matchMedia', () => ({ matches: false }));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

it.each([
  [{ inscrito: false, userId: 'atual' }, 'inativo'],
  [{ inscrito: true, userId: 'outro' }, 'inativo'],
  [{ inscrito: true, userId: 'atual' }, 'ativo'],
] as const)('push depende do registro da sessão: %j', async (registro, esperado) => {
  mocks.fetch.mockResolvedValue({ ok: true, json: async () => registro });
  const { result } = renderHook(() => usePushLembretes());
  await waitFor(() => expect(mocks.fetch).toHaveBeenCalled());
  await waitFor(() => expect(result.current.estado).toBe(esperado));
  expect(mocks.fetch).toHaveBeenCalledWith(expect.stringContaining('endpoint=https%3A'), { cache: 'no-store' });
});
it.each([false, true])('remove endpoint antes de sair; erro de push=%s', async (falha) => {
  if (falha) mocks.fetch.mockRejectedValue(new Error('fixture'));
  else mocks.fetch.mockResolvedValue({ ok: true });
  const { result } = renderHook(() => useAuth());
  await waitFor(() => expect(result.current.loading).toBe(false));
  await act(async () => result.current.signOut());
  expect(mocks.fetch).toHaveBeenCalledWith('/api/push/subscribe', expect.objectContaining({
    method: 'DELETE', body: JSON.stringify({ endpoint: 'https://example.invalid/push' }),
  }));
  expect(mocks.fetch.mock.invocationCallOrder[0]).toBeLessThan(mocks.signOut.mock.invocationCallOrder[0]!);
  expect(mocks.signOut).toHaveBeenCalled();
  expect(mocks.push).toHaveBeenCalledWith('/login');
});
it.each([useCriarTransacao, useAtualizarTransacao, useExcluirTransacao])('mutação invalida resumo financeiro: %s', hook => {
  // Sem esperar getUser: o estado de auth é compartilhado (uma chamada por aba), não um por hook.
  const { result } = renderHook(() => hook());
  act(() => (result.current as unknown as { onSuccess: () => void }).onSuccess());
  expect(mocks.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['resumo-financeiro-mes'] });
});
