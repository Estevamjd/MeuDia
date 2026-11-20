// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AppModeProvider } from '../../components/AppModeProvider';

/** Concluir no Plano tem de refletir na aba Treino (/treinos): a lista de sessões dela é invalidada. */
const { finalizarSessao, findByUserAndDateRange } = vi.hoisted(() => ({
  finalizarSessao: vi.fn(),
  findByUserAndDateRange: vi.fn(),
}));
vi.mock('@meudia/api', () => ({ treinoService: { finalizarSessao }, sessaoRepository: { findByUserAndDateRange } }));
vi.mock('../useAuth', () => ({ useAuth: () => ({ user: { id: 'u1' }, loading: false }) }));

import { useFinalizarSessao, useSessoesTreinoDesde } from '../useTreinos';

beforeEach(() => {
  finalizarSessao.mockReset().mockResolvedValue({ id: 's1', concluido: true });
  findByUserAndDateRange.mockReset().mockResolvedValue([]);
  vi.useFakeTimers({ toFake: ['Date'] });
  // 22:30 em BRT de 19/11 = 01:30 UTC de 20/11: "até hoje" é 19/11 (SP), não o dia UTC.
  vi.setSystemTime(new Date('2026-11-20T01:30:00Z'));
});
afterEach(() => {
  vi.useRealTimers();
  cleanup();
});

it('useSessoesTreinoDesde busca do início da janela até hoje em SP; concluir a sessão refaz a busca', async () => {
  const cliente = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={cliente}>
      <AppModeProvider mode="financas" vapidPublicKey={null}>{children}</AppModeProvider>
    </QueryClientProvider>
  );
  const { result } = renderHook(() => ({ sessoes: useSessoesTreinoDesde('2026-09-24'), finalizar: useFinalizarSessao() }), { wrapper });
  await waitFor(() => expect(findByUserAndDateRange).toHaveBeenCalledWith('u1', '2026-09-24', '2026-11-19'));
  expect(findByUserAndDateRange).toHaveBeenCalledTimes(1);

  await act(() => result.current.finalizar.mutateAsync({ sessaoId: 's1', duracao: 50 }));
  await waitFor(() => expect(findByUserAndDateRange).toHaveBeenCalledTimes(2));
});
