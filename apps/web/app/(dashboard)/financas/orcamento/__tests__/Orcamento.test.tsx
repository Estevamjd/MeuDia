// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { ToastProvider } from '../../../../../components/ui';
import OrcamentoPage from '../page';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/financas/orcamento',
  useSearchParams: () => new URLSearchParams(),
}));

const ok = <T,>(data: T) => ({ data, isLoading: false, isPending: false, isError: false, isSuccess: true, isFetching: false, refetch: vi.fn() });
const mutation = { mutate: vi.fn(), isPending: false };
vi.mock('../../../../../hooks', () => ({
  useOrcamento: () => ok([]),
  useTransacoesMes: () => ok([]),
  useRendas: () => ok([{ id: 'r', descricao: 'Salário', valor: 1000, dia_recebimento: 5, ativo: true }]),
  // A antiga "Sobra prevista" (renda − gasto previsto) daria 700; a sobra única do app é −100.
  useResumoFinanceiroMes: () => ok({ rendaPrevista: 1000, gastoPrevisto: 300, sobraDoMes: -100, sobraPrevista: 700 }),
  useSalvarOrcamento: () => mutation,
  useExcluirOrcamento: () => mutation,
  useCriarRenda: () => mutation,
  useAtualizarRenda: () => mutation,
  useExcluirRenda: () => mutation,
}));

afterEach(cleanup);

describe('Orçamento: uma sobra só', () => {
  it('não mostra "Sobra prevista"; mostra "No fim do mês sobra" com o valor do sobraDoMes', () => {
    render(<ToastProvider><OrcamentoPage /></ToastProvider>);
    expect(screen.queryByText(/sobra prevista/i)).toBeNull();
    const previsao = screen.getByRole('region', { name: 'Previsão do mês' });
    expect(within(previsao).getByText('No fim do mês sobra')).toBeTruthy();
    expect(previsao.textContent).toMatch(/-R\$\s?100,00|−R\$\s?100,00|R\$\s?-100,00/);
    expect(previsao.textContent).not.toMatch(/700,00/);
  });
});
