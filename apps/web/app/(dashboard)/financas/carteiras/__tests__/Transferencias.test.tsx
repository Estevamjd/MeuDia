// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ToastProvider } from '../../../../../components/ui';
import CarteirasPage from '../page';

const estado = (o: Record<string, unknown>) => ({ data: undefined, isLoading: false, isPending: false, isError: false, isSuccess: false, isFetching: false, refetch: vi.fn(), ...o });
const ok = <T,>(data: T) => estado({ data, isSuccess: true });
const mutacao = () => ({ mutate: vi.fn(), isPending: false });

const { useTransferencias } = vi.hoisted(() => ({ useTransferencias: vi.fn() }));

vi.mock('@meudia/shared', async (orig) => ({ ...(await orig<Record<string, unknown>>()), hojeSP: () => '2026-11-20' }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  usePathname: () => '/financas/carteiras',
  useSearchParams: () => new URLSearchParams(),
}));
const nubank = { id: 'c1', user_id: 'u', nome: 'Nubank', tipo: 'banco', incluir_no_total: true, arquivada: false };
vi.mock('../../../../../hooks', () => ({
  usePainelSaldo: () => ok({ carteiras: [{ carteira: nubank, saldo: 100 }], arquivadas: [], saldoHoje: 100, cofrinho: null }),
  useTransferencias,
  useAtualizarCarteira: () => mutacao(),
  useCriarCarteira: () => mutacao(),
  useCorrigirSaldo: () => mutacao(),
  useExcluirCarteira: () => mutacao(),
  useExcluirTransferencia: () => mutacao(),
}));

const ERRO = 'Não foi possível carregar as transferências.';
const tela = () => render(<ToastProvider><CarteirasPage /></ToastProvider>);

beforeEach(() => useTransferencias.mockReset());
afterEach(cleanup);

describe('Bancos: transferências com erro não viram lista vazia', () => {
  it('painel ok + transferências rejeitadas: seção "Transferências" com erro e "Tentar de novo"', () => {
    const refetch = vi.fn();
    useTransferencias.mockReturnValue(estado({ isError: true, refetch }));
    tela();
    expect(screen.getByText('Nubank')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Transferências' })).toBeTruthy();
    expect(screen.getByRole('alert').textContent).toContain(ERRO);
    const botao = screen.getByRole('button', { name: 'Tentar de novo' });
    expect(botao.className).toContain('min-h-[44px]');
    fireEvent.click(botao);
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it('carregamento inicial sem dados: não mostra erro nem botão', () => {
    useTransferencias.mockReturnValue(estado({ isPending: true, isLoading: true, isFetching: true }));
    tela();
    expect(screen.queryByText(ERRO)).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Tentar de novo' })).toBeNull();
  });

  it('"Tentar de novo" sem cache (consulta volta a pending): seção e botão seguem montados, com foco e aria-busy', () => {
    const refetch = vi.fn();
    useTransferencias.mockReturnValue(estado({ isError: true, refetch }));
    const { rerender } = tela();
    const botao = screen.getByRole('button', { name: 'Tentar de novo' });
    botao.focus();
    fireEvent.click(botao);
    expect(refetch).toHaveBeenCalledTimes(1);

    // react-query 5: refetch de consulta com erro e sem dados reseta para status 'pending' (isError = false).
    useTransferencias.mockReturnValue(estado({ isPending: true, isLoading: true, isFetching: true, refetch }));
    rerender(<ToastProvider><CarteirasPage /></ToastProvider>);
    expect(screen.getByRole('heading', { name: 'Transferências' })).toBeTruthy();
    const mesmo = screen.getByRole('button', { name: 'Carregando…' });
    expect(mesmo).toBe(botao);
    expect(document.activeElement).toBe(botao);
    expect(mesmo.getAttribute('aria-busy')).toBe('true');
    expect(mesmo.getAttribute('aria-disabled')).toBe('true');
    expect(screen.queryByText(ERRO)).toBeNull();
    fireEvent.click(mesmo);
    expect(refetch).toHaveBeenCalledTimes(1);

    // Falhou de novo: volta o erro no mesmo botão.
    useTransferencias.mockReturnValue(estado({ isError: true, refetch }));
    rerender(<ToastProvider><CarteirasPage /></ToastProvider>);
    expect(screen.getByRole('alert').textContent).toContain(ERRO);
    expect(screen.getByRole('button', { name: 'Tentar de novo' })).toBe(botao);
    expect(document.activeElement).toBe(botao);
  });

  it('erro com isFetching (retry com status ainda error) não pisca a mensagem de erro', () => {
    useTransferencias.mockReturnValue(estado({ isError: true, isFetching: true }));
    tela();
    expect(screen.queryByText(ERRO)).toBeNull();
  });

  it('transferências ok: lista sem erro', () => {
    useTransferencias.mockReturnValue(
      ok([{ id: 't1', user_id: 'u', origem_id: 'c1', destino_id: null, valor: 50, data: '2026-11-10', descricao: null, created_at: null }]),
    );
    tela();
    expect(screen.getByRole('heading', { name: 'Transferências' })).toBeTruthy();
    expect(screen.queryByText(ERRO)).toBeNull();
    expect(screen.getByRole('button', { name: /Excluir transferência/ })).toBeTruthy();
  });
});
