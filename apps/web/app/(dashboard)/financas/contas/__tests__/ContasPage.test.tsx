// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ToastProvider } from '../../../../../components/ui';
import ContasPage from '../page';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/financas/contas',
  useSearchParams: () => new URLSearchParams(),
}));

const mutation = { mutate: vi.fn(), isPending: false };
vi.mock('../../../../../hooks', () => ({
  useContas: () => ({ data: [], isLoading: false, isError: false, refetch: vi.fn() }),
  useCriarConta: () => mutation,
  useAtualizarConta: () => mutation,
  useDesativarConta: () => mutation,
  usePushLembretes: () => ({ estado: 'carregando', ocupado: false, ativar: vi.fn(), desativar: vi.fn() }),
}));

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const passarAutofoco = () => act(() => vi.advanceTimersByTime(150));
const campo = (label: string) => screen.getByLabelText(label) as HTMLInputElement | HTMLSelectElement;

/** Foca o campo, digita/escolhe e confere que o foco não voltou para "Nome". */
function preencher(label: string, valor: string) {
  const el = campo(label);
  act(() => el.focus());
  fireEvent.change(el, { target: { value: valor } });
  passarAutofoco();
  expect(document.activeElement).toBe(campo(label));
  expect(campo(label).value).toBe(valor);
}

describe('Contas — modal "Nova conta"', () => {
  it('digitar em cada campo mantém o foco nele e preserva os valores', () => {
    render(
      <ToastProvider>
        <ContasPage />
      </ToastProvider>,
    );
    fireEvent.click(screen.getAllByRole('button', { name: /Nova conta/ })[0]!);
    passarAutofoco();
    expect(document.activeElement).toBe(campo('Nome'));

    preencher('Nome', 'Luz');
    preencher('Valor (R$)', '180.50');
    preencher('Dia do vencimento', '10');
    preencher('Categoria', 'Casa');

    preencher('Recorrência', 'anual');
    preencher('Mês do vencimento', '3');
    expect(campo('Dia do vencimento').value).toBe('10');

    preencher('Recorrência', 'unica');
    preencher('Data do vencimento', '2026-11-05');

    expect(campo('Nome').value).toBe('Luz');
    expect(campo('Valor (R$)').value).toBe('180.50');
    expect(campo('Categoria').value).toBe('Casa');
    expect(campo('Recorrência').value).toBe('unica');
  });
});
