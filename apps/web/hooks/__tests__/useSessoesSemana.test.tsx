// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { cleanup, render, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AppModeProvider } from '../../components/AppModeProvider';
import type { AppMode } from '../../lib/app-mode';

/** C-1: no modo Finanças o AgentPanel do layout montava useSessoesSemana e consultava `sessoes_treino` em toda página. */
const { obterSessoesSemana } = vi.hoisted(() => ({ obterSessoesSemana: vi.fn() }));
vi.mock('@meudia/api', () => ({ treinoService: { obterSessoesSemana } }));
vi.mock('../useAuth', () => ({ useAuth: () => ({ user: { id: 'u1' }, loading: false }) }));

import { useSessoesSemana } from '../useTreinos';

beforeEach(() => {
  obterSessoesSemana.mockReset().mockResolvedValue([]);
});
afterEach(cleanup);

function montar(mode: AppMode, opcoes?: { noModoFinancas?: boolean }) {
  function Quem() {
    useSessoesSemana(opcoes);
    return null;
  }
  const cliente = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const Envelope = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={cliente}>
      <AppModeProvider mode={mode} vapidPublicKey={null}>{children}</AppModeProvider>
    </QueryClientProvider>
  );
  render(<Quem />, { wrapper: Envelope });
}

it('modo Finanças não consulta sessões de treino', async () => {
  montar('financas');
  await new Promise((r) => setTimeout(r, 20));
  expect(obterSessoesSemana).not.toHaveBeenCalled();
});

it('modo padrão segue consultando as sessões da semana', async () => {
  montar('padrao');
  await waitFor(() => expect(obterSessoesSemana).toHaveBeenCalledWith('u1'));
});

it('a tela /treinos consulta também no modo Finanças (Treinos aparece para todos)', async () => {
  montar('financas', { noModoFinancas: true });
  await waitFor(() => expect(obterSessoesSemana).toHaveBeenCalledWith('u1'));
});
