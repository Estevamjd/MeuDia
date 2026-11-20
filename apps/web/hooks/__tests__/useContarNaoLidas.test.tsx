// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, render, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

/** P0.1: o polling de 60s do contador é opcional (badge do FAB no modo padrão); fora dele, sem intervalo. */
const { contarNaoLidas } = vi.hoisted(() => ({ contarNaoLidas: vi.fn() }));
vi.mock('@meudia/api', () => ({ agenteService: { contarNaoLidas } }));
vi.mock('../useAuth', () => ({ useAuth: () => ({ user: { id: 'u1' }, loading: false }) }));

import { INTERVALO_CONTAR_NAO_LIDAS, useContarNaoLidas } from '../useAgente';

beforeEach(() => {
  contarNaoLidas.mockReset().mockResolvedValue(0);
});
afterEach(cleanup);

function montar(opcoes?: Parameters<typeof useContarNaoLidas>[0]) {
  function Quem() {
    useContarNaoLidas(opcoes);
    return null;
  }
  const cliente = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={cliente}>
      <Quem />
    </QueryClientProvider>,
  );
  const opcoesDaQuery = () =>
    cliente.getQueryCache().find({ queryKey: ['notificacoes-agente-count', 'u1'] })?.observers[0]?.options;
  return { opcoesDaQuery };
}

it('padrão: consulta e repete a cada 60s', async () => {
  const { opcoesDaQuery } = montar();
  await waitFor(() => expect(contarNaoLidas).toHaveBeenCalledWith('u1'));
  expect(INTERVALO_CONTAR_NAO_LIDAS).toBe(60_000);
  expect(opcoesDaQuery()?.refetchInterval).toBe(60_000);
});

it('poll: false consulta sem intervalo', async () => {
  const { opcoesDaQuery } = montar({ poll: false });
  await waitFor(() => expect(contarNaoLidas).toHaveBeenCalledWith('u1'));
  expect(opcoesDaQuery()?.refetchInterval).toBe(false);
});

it('enabled: false não consulta', async () => {
  montar({ enabled: false, poll: false });
  await new Promise((r) => setTimeout(r, 20));
  expect(contarNaoLidas).not.toHaveBeenCalled();
});
