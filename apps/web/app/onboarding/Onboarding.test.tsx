// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Page from './page';
const m = vi.hoisted(() => ({ upsert: vi.fn(), criar: vi.fn(), replace: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: m.replace, refresh: vi.fn() }) }));
const usuario = { id: 'u', email: 'teste@example.test', user_metadata: {} };
vi.mock('../../hooks/useAuth', () => ({ useAuth: () => ({ user: usuario, loading: false }) }));
vi.mock('../../lib/supabase/client', () => ({ createClient: () => ({ from: () => ({ upsert: m.upsert }) }) }));
vi.mock('../../components/AppModeProvider', () => ({ useAppMode: () => 'financas' }));
vi.mock('@meudia/api', () => ({ carteirasService: { criarCarteiraOnboarding: m.criar } }));
function montar() { return render(<QueryClientProvider client={new QueryClient()}><Page /></QueryClientProvider>); }
beforeEach(() => { vi.resetAllMocks(); localStorage.clear(); m.upsert.mockResolvedValue({ error: null }); m.criar.mockResolvedValue({}); });
afterEach(cleanup);
it('falha no segundo banco mantém perfil incompleto; remover/reordenar e recarregar preserva UUIDs', async () => {
  const linhas = [{ id: crypto.randomUUID(), nome: 'Nu', digitos: '10000' }, { id: crypto.randomUUID(), nome: 'Caixa', digitos: '5000', negativo: true }];
  localStorage.setItem('onboarding-carteiras:u', JSON.stringify(linhas));
  m.criar.mockResolvedValueOnce({}).mockRejectedValueOnce(new Error('offline'));
  const view = montar();
  fireEvent.click(screen.getByRole('button', { name: 'Continuar' }));
  fireEvent.click(screen.getByRole('button', { name: 'Concluir' }));
  await screen.findByRole('alert');
  expect(m.upsert.mock.calls.every(([p]) => !p.onboarding_feito)).toBe(true);
  expect(m.replace).not.toHaveBeenCalled();
  expect(m.criar).toHaveBeenNthCalledWith(2, 'u', linhas[1]!.id, expect.objectContaining({ saldo_inicial: -50 }));
  fireEvent.click(screen.getByRole('button', { name: 'Remover banco 1' }));
  fireEvent.change(screen.getByLabelText('Banco ou carteira 1'), { target: { value: 'Caixa editada' } });
  view.unmount();
  montar();
  fireEvent.click(screen.getByRole('button', { name: 'Continuar' }));
  expect((screen.getByLabelText('Banco ou carteira 1') as HTMLInputElement).value).toBe('Caixa editada');
  fireEvent.click(screen.getByRole('button', { name: 'Concluir' }));
  await waitFor(() => expect(m.replace).toHaveBeenCalled());
  expect(m.criar).toHaveBeenLastCalledWith('u', linhas[1]!.id, expect.objectContaining({ nome: 'Caixa editada', saldo_inicial: -50, ordem: 0 }));
  expect(m.upsert.mock.calls.at(-1)![0].onboarding_feito).toBe(true);
});
it('controle Está negativo envia saldo negativo', async () => {
  montar();
  fireEvent.click(screen.getByRole('button', { name: 'Continuar' }));
  fireEvent.change(screen.getByLabelText('Banco ou carteira 1'), { target: { value: 'Cheque especial' } });
  fireEvent.change(screen.getByLabelText('Quanto tem hoje (1)'), { target: { value: '10000' } });
  fireEvent.click(screen.getByRole('checkbox', { name: 'Está negativo' }));
  fireEvent.click(screen.getByRole('button', { name: 'Concluir' }));
  await waitFor(() => expect(m.replace).toHaveBeenCalled());
  expect(m.criar).toHaveBeenCalledWith('u', expect.any(String), expect.objectContaining({ saldo_inicial: -100 }));
});
it('perfil já concluído que passa pelo onboarding não volta a ficar incompleto se os bancos falharem', async () => {
  m.criar.mockRejectedValueOnce(new Error('offline'));
  montar();
  fireEvent.click(screen.getByRole('button', { name: 'Continuar' }));
  fireEvent.change(screen.getByLabelText('Banco ou carteira 1'), { target: { value: 'Nubank' } });
  fireEvent.click(screen.getByRole('button', { name: 'Concluir' }));
  await screen.findByRole('alert');
  // A 1ª gravação (antes dos bancos) não manda onboarding_feito: o upsert cria com o DEFAULT false do banco e,
  // se a linha já existe com true, não rebaixa.
  expect(m.upsert).toHaveBeenCalledTimes(1);
  expect(m.upsert.mock.calls[0]![0]).not.toHaveProperty('onboarding_feito');
});
