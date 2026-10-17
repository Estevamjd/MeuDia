// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import Page from '../page';
const m = vi.hoisted(() => ({ transacoes: [] as unknown[] }));
const vazio = { data: undefined, isLoading: false };
vi.mock('../../../../hooks', () => ({
  useProfile: () => ({ data: { nome: 'Ana' }, isLoading: false }),
  useTreinos: () => vazio, useSessoesSemana: () => vazio, useHabitos: () => vazio, useRegistrosHoje: () => vazio,
  useResumoMensal: () => vazio, useAssinaturas: () => vazio, useTotalMensal: () => vazio,
  useTransacoesMes: () => ({ data: m.transacoes }),
}));
vi.mock('../../../../hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u' } }) }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('../../../../components/agent', () => ({ AgentBanner: () => null }));
afterEach(cleanup);

const tx = (categoria: string, valor: number, ajuste = false) => ({ tipo: 'despesa', categoria, valor, ajuste });

it('Gastos por Categoria ignora ajustes de saldo (não são gasto)', () => {
  m.transacoes = [tx('Ajuste de saldo', 900, true), tx('Mercado', 30), { ...tx('Salário', 2000), tipo: 'receita' }];
  render(<Page />);
  expect(screen.getByText('Mercado')).toBeTruthy();
  expect(screen.queryByText('Ajuste de saldo')).toBeNull();
});

it('só ajustes no mês: nenhuma despesa registrada', () => {
  m.transacoes = [tx('Ajuste de saldo', 900, true)];
  render(<Page />);
  expect(screen.getByText(/Nenhuma despesa registrada/)).toBeTruthy();
});
