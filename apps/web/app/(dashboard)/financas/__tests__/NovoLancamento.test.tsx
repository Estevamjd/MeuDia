// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import Page from '../page';
const m = vi.hoisted(() => ({ criar: vi.fn(), carteiras: [] as unknown[] }));
vi.mock('../../../../hooks', () => ({
  useCarteiras: () => ({ data: m.carteiras, isSuccess: true }),
  useCriarTransacao: () => ({ mutate: m.criar }), useAtualizarTransacao: () => ({}), useExcluirTransacao: () => ({}),
}));
vi.mock('../../../../components/ui', async (original) => ({ ...await original<object>(), useToast: () => ({ success: vi.fn(), error: vi.fn() }) }));
vi.mock('../../../../components/AppModeProvider', () => ({ useAppMode: () => 'financas' }));
vi.mock('../../../../components/financas/home/useFinancasHome', () => ({ useFinancasHome: (_c: unknown, _d: unknown, a: object) => a }));
vi.mock('../../../../components/financas/home/FinancasHomeView', () => ({ FinancasHomeView: ({ onNovo }: { onNovo: () => void }) => <button onClick={onNovo}>Novo lançamento</button> }));
vi.mock('../../../../components/financas/LancamentoRapidoSheet', () => ({ LancamentoRapidoSheet: () => null }));
afterEach(cleanup);
beforeEach(() => vi.clearAllMocks());
it.each([false, true])('formulário envia carteira quando disponível (%s)', (temCarteira) => {
  m.carteiras = temCarteira ? [{ id: 'nu', nome: 'Nubank', tipo: 'banco', arquivada: false }] : [];
  render(<Page />);
  fireEvent.click(screen.getByRole('button', { name: 'Novo lançamento' }));
  const categoria = screen.getByPlaceholderText('Ex.: Alimentação, Transporte…');
  fireEvent.change(categoria, { target: { value: 'Mercado' } });
  fireEvent.change(screen.getByPlaceholderText('Descrição do lançamento'), { target: { value: 'Compra' } });
  fireEvent.change(screen.getByPlaceholderText('0,00'), { target: { value: '25' } });
  if (temCarteira) {
    expect(screen.getByRole('radio', { name: 'Nubank' }).getAttribute('aria-checked')).toBe('true');
    expect(screen.queryByPlaceholderText('Ex.: Nubank, Itaú…')).toBeNull();
  } else fireEvent.change(screen.getByPlaceholderText('Ex.: Nubank, Itaú…'), { target: { value: 'Legado' } });
  fireEvent.submit(categoria.closest('form')!);
  expect(m.criar).toHaveBeenCalledWith(expect.objectContaining({ carteira_id: temCarteira ? 'nu' : undefined, banco: temCarteira ? 'Nubank' : 'Legado', valor: 25 }), expect.anything());
});
