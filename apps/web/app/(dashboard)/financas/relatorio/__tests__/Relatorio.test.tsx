// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import type { Transacao } from '@meudia/shared';
import { montarResumoMes } from '../../../../../components/financas/resumo/montarResumoMes';
import { sobraPorMes } from '../../../../../components/financas/painel/montarPainel';
import RelatorioPage from '../page';

const ok = <T,>(data: T) => ({ data, isLoading: false, isPending: false, isError: false, isSuccess: true, isFetching: false, refetch: vi.fn() });

const { useTransacoesFaixa, montarDashboard, painelProps } = vi.hoisted(() => ({
  useTransacoesFaixa: vi.fn(),
  montarDashboard: vi.fn((..._args: unknown[]) => ({ sobraMes: null, evolucao: [] })),
  painelProps: [] as Record<string, unknown>[],
}));

vi.mock('@meudia/shared', async (orig) => ({ ...(await orig<Record<string, unknown>>()), hojeSP: () => '2026-11-20' }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }), usePathname: () => '/financas/relatorio' }));
vi.mock('../../../../../hooks', () => ({ useTransacoesFaixa, usePainelSaldo: () => ok({ painel: 'fake' }) }));
vi.mock('../../../../../hooks/useProfile', () => ({ useProfile: () => ok({ nome: 'Lia Souza' }) }));
vi.mock('../../../../../components/financas/home/montarDashboard', () => ({ montarDashboard }));
vi.mock('../../../../../components/financas/painel/PainelView', () => ({
  PainelView: (props: Record<string, unknown>) => {
    painelProps.push(props);
    return <div data-testid="painel" />;
  },
}));

let seq = 0;
const t = (data: string, tipo: 'receita' | 'despesa', valor: number, extra: Partial<Transacao> = {}): Transacao =>
  ({ id: `t${String(++seq).padStart(3, '0')}`, user_id: 'u', tipo, categoria: 'Outros', descricao: 'x', valor, data, banco: null, automatico: false, created_at: `${data}T12:00:00Z`, carteira_id: null, ajuste: false, origem: 'app', ...extra }) as unknown as Transacao;

// Faixa em ordem (data, id), como volta do repositório: 6 meses, inclusive bordas e um ajuste.
const faixa: Transacao[] = [
  t('2026-06-01', 'receita', 1000), t('2026-06-30', 'despesa', 400.1),
  t('2026-07-15', 'despesa', 50), t('2026-07-15', 'despesa', 20, { ajuste: true }),
  // agosto sem lançamento (some do "Quanto sobrou por mês")
  t('2026-09-10', 'receita', 300), t('2026-10-31', 'despesa', 99.99),
  t('2026-11-01', 'receita', 943), t('2026-11-05', 'despesa', 300, { origem: 'whatsapp' }),
  t('2026-11-05', 'despesa', 80), t('2026-11-30', 'despesa', 59.9, { origem: 'whatsapp' }),
];

beforeEach(() => {
  painelProps.length = 0;
  montarDashboard.mockClear();
  useTransacoesFaixa.mockReturnValue(ok(faixa));
});
afterEach(cleanup);

describe('Painel (relatório): uma consulta só para os 6 meses', () => {
  it('pede a faixa 1º de junho → 30 de novembro numa chamada só', () => {
    render(<RelatorioPage />);
    expect(new Set(useTransacoesFaixa.mock.calls.map((c) => c.join('|')))).toEqual(new Set(['2026-06-01|2026-11-30']));
  });

  it('o mês mostrado recebe só as linhas de novembro, em data decrescente (como transacoesDoMes)', () => {
    render(<RelatorioPage />);
    const novembro = faixa.filter((x) => x.data.startsWith('2026-11'));
    const esperado = [...novembro].sort((a, b) => b.data.localeCompare(a.data) || b.id.localeCompare(a.id));
    const doMes = montarDashboard.mock.calls.at(-1)![3] as unknown as Transacao[];
    expect(doMes.map((x) => x.id)).toEqual(esperado.map((x) => x.id));
    const props = painelProps.at(-1)!;
    expect(props.resumo).toEqual(montarResumoMes('2026-11', esperado, null));
  });

  it('"Quanto sobrou por mês" igual ao cálculo mês a mês e contagem/origem só do mês', () => {
    render(<RelatorioPage />);
    const porMes = (c: string) => faixa.filter((x) => x.data.startsWith(c));
    const esperado = sobraPorMes(
      ['2026-06', '2026-07', '2026-08', '2026-09', '2026-10', '2026-11'].map((c) => ({ competencia: c as never, transacoes: porMes(c) })),
      null,
    );
    expect(painelProps.at(-1)!.meses).toEqual(esperado);
    expect(esperado.map((m) => [m.competencia, m.valor])).toEqual([
      ['2026-06', 599.9], ['2026-07', -50], ['2026-09', 300], ['2026-10', -99.99], ['2026-11', 503.1],
    ]);
    expect(screen.getByText(/4 lançamentos · 2 pelo WhatsApp e 2 pelo app · novembro de 2026/)).toBeTruthy();
  });
});
