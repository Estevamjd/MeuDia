// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook } from '@testing-library/react';
import { useExclusaoLancamento } from '../useExclusaoLancamento';

const m = vi.hoisted(() => ({
  toast: { error: vi.fn(), success: vi.fn() },
  vinculos: { recebimentos: [] as unknown[], pagamentos: [] as unknown[] },
  excluir: { mutate: vi.fn(), isPending: false },
  desfazerPagamento: { mutate: vi.fn(), isPending: false },
  desfazerRecebimento: { mutate: vi.fn(), isPending: false },
}));
vi.mock('../../../hooks', () => ({
  useVinculosTransacoes: () => ({ data: m.vinculos, isSuccess: true, refetch: vi.fn() }),
  useDesfazerRecebimento: () => m.desfazerRecebimento,
  useDesfazerPagamento: () => m.desfazerPagamento,
  useExcluirTransacao: () => m.excluir,
}));
vi.mock('../../ui', async (original) => ({ ...await original<object>(), useToast: () => m.toast }));

beforeEach(() => {
  vi.clearAllMocks();
  m.vinculos = { recebimentos: [], pagamentos: [] };
});
afterEach(cleanup);
const montar = () => renderHook(() => useExclusaoLancamento([])).result;

describe('useExclusaoLancamento: excluir lançamento (sempre com confirmação)', () => {
  const tx = (id: string, over: Record<string, unknown> = {}) => ({
    id, user_id: 'u', tipo: 'despesa', categoria: 'Comida', descricao: id, valor: 25, data: '2026-10-16', banco: null,
    automatico: false, created_at: null, carteira_id: 'n', ajuste: false, ...over,
  }) as never;

  it('Gastei: nada some antes de confirmar; confirmar exclui o lançamento', () => {
    const r = montar();
    act(() => r.current.pedirExclusao(tx('gasto')));
    expect(m.excluir.mutate).not.toHaveBeenCalled();
    expect(r.current.exclusao?.detalhe).toBe('O lançamento sai e o saldo do banco volta ao que era.');
    act(() => r.current.exclusao?.onConfirmar());
    expect(m.excluir.mutate).toHaveBeenCalledWith('gasto', expect.anything());
    expect(m.desfazerPagamento.mutate).not.toHaveBeenCalled();
    // Cancelar fecha sem apagar.
    act(() => r.current.pedirExclusao(tx('outro')));
    act(() => r.current.exclusao?.onCancelar());
    expect(r.current.exclusao).toBeNull();
    expect(m.excluir.mutate).toHaveBeenCalledTimes(1);
  });

  it('lançamento do Paguei: confirmação avisa e excluir chama desfazer_pagamento (nunca DELETE direto)', () => {
    m.vinculos = { recebimentos: [], pagamentos: [{ conta_id: 'luz', competencia: '2026-10', transacao_id: 'pag' }] };
    const r = montar();
    act(() => r.current.pedirExclusao(tx('pag')));
    expect(r.current.exclusao?.detalhe).toBe('Ele veio do "Paguei": o lançamento sai e a conta volta a ficar a pagar.');
    act(() => r.current.exclusao?.onConfirmar());
    expect(m.desfazerPagamento.mutate).toHaveBeenCalledWith({ contaId: 'luz', competencia: '2026-10' }, expect.anything());
    expect(m.excluir.mutate).not.toHaveBeenCalled();
  });

  it('lançamento do Recebi: excluir chama desfazer_recebimento; renda volta a ficar a receber', () => {
    m.vinculos = { recebimentos: [{ renda_id: 'r', competencia: '2026-10', transacao_id: 'rec' }], pagamentos: [] };
    const r = montar();
    act(() => r.current.pedirExclusao(tx('rec', { tipo: 'receita' })));
    expect(r.current.exclusao?.detalhe).toBe('Ele veio do "Recebi": o lançamento sai e a renda volta a ficar a receber.');
    act(() => r.current.exclusao?.onConfirmar());
    expect(m.desfazerRecebimento.mutate).toHaveBeenCalledWith({ rendaId: 'r', competencia: '2026-10' }, expect.anything());
    expect(m.excluir.mutate).not.toHaveBeenCalled();
  });

  it('ajuste de saldo pode ser excluído (o saldo volta ao anterior); lançamento sem banco não fala de saldo', () => {
    const r = montar();
    act(() => r.current.pedirExclusao(tx('aj', { ajuste: true })));
    expect(r.current.exclusao?.detalhe).toBe('É um ajuste de saldo: o saldo do banco volta ao que era antes da correção.');
    act(() => r.current.pedirExclusao(tx('sem', { carteira_id: null })));
    expect(r.current.exclusao?.detalhe).toBe('O lançamento sai do mês.');
  });
});

it('a confirmação de Gastos mostra "Excluir? Isso não pode ser desfeito." + o efeito; Cancelar fecha sem apagar', async () => {
  const { render, screen, fireEvent } = await import('@testing-library/react');
  const { createElement } = await import('react');
  const { ConfirmarExclusao } = await import('../ConfirmarExclusao');
  const r = montar();
  act(() => r.current.pedirExclusao({ id: 'g', descricao: 'Lanche', tipo: 'despesa', carteira_id: 'n', ajuste: false } as never));
  const e = r.current.exclusao!;
  render(createElement(ConfirmarExclusao, { isOpen: true, onClose: e.onCancelar, onConfirm: e.onConfirmar, titulo: 'Excluir lançamento', detalhe: e.detalhe }));
  expect(screen.getByRole('dialog', { name: 'Excluir lançamento' }).textContent).toContain('Excluir? Isso não pode ser desfeito. O lançamento sai e o saldo do banco volta ao que era.');
  fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
  expect(m.excluir.mutate).not.toHaveBeenCalled();
  expect(r.current.exclusao).toBeNull();
});
