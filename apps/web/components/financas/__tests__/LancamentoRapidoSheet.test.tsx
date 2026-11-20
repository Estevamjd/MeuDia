// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { LancamentoRapidoSheet, type AcaoRapida } from '../LancamentoRapidoSheet';

const NUBANK = { id: 'nu', nome: 'Nubank', tipo: 'banco', arquivada: false };
const CAIXA = { id: 'cx', nome: 'Caixa', tipo: 'banco', arquivada: false };
const m = vi.hoisted(() => ({ transferir: vi.fn(() => ({ mutate: () => undefined, isPending: false })) }));
vi.mock('../../../hooks', () => ({
  useCarteiras: () => ({ data: [NUBANK, CAIXA], isLoading: false }),
  usePainelSaldo: () => ({ data: { carteiraPadraoId: 'nu' } }),
  useGastei: () => ({ mutate: vi.fn(), isPending: false }),
  useCriarDespesaParcelada: () => ({ mutate: vi.fn(), isPending: false }),
  useEntrouDinheiro: () => ({ mutate: vi.fn(), isPending: false }),
  useTransferir: m.transferir,
}));
vi.mock('../../ui', async (original) => ({ ...await original<object>(), useToast: () => ({ success: vi.fn(), error: vi.fn() }) }));
afterEach(cleanup);

function Tela({ open, inicial }: { open: boolean; inicial: AcaoRapida }) {
  return <LancamentoRapidoSheet open={open} inicial={inicial} onClose={() => undefined} />;
}

/** Regressão (19/11/2026): Gastei logo depois de uma transferência apagava o valor digitado. */
it('reabrir no Gastei depois de um Transferir nunca mostra o form antigo, nem por um quadro', () => {
  const { rerender } = render(<Tela open inicial="transferir" />);
  expect(screen.getByRole('heading', { name: 'Transferir' })).toBeTruthy();
  rerender(<Tela open={false} inicial="transferir" />);

  // O form de transferir não pode renderizar nem num commit intermediário (era o quadro que apagava o valor).
  m.transferir.mockClear();
  act(() => rerender(<Tela open inicial="gastei" />));
  expect(m.transferir).not.toHaveBeenCalled();

  expect(screen.getByRole('heading', { name: 'Gastei' })).toBeTruthy();

  // O valor digitado logo após abrir continua lá.
  const valor = screen.getByLabelText('Valor') as HTMLInputElement;
  fireEvent.change(valor, { target: { value: '2500' } });
  expect(valor.value).toMatch(/25,00/);
  expect((screen.getByLabelText('Valor') as HTMLInputElement).value).toMatch(/25,00/);
});
