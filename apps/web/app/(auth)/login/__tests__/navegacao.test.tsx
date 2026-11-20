// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import LoginPage from '../page';
import NovaSenhaPage from '../../nova-senha/page';

const mocks = vi.hoisted(() => ({
  push: vi.fn(), refresh: vi.fn(), assign: vi.fn(),
  home: vi.fn(async () => '/financas'),
  auth: {
    signInWithPassword: vi.fn(async () => ({ error: null })),
    updateUser: vi.fn(async () => ({ error: null })),
    getSession: vi.fn(async () => ({ data: { session: {} } })),
  },
}));
vi.mock('next/navigation', () => ({ useRouter: () => mocks, useSearchParams: () => new URLSearchParams() }));
vi.mock('../../../../lib/supabase/client', () => ({ createClient: () => ({ auth: mocks.auth }) }));
vi.mock('../../../../lib/destino-apos-auth', () => ({ destinoAposAuth: mocks.home }));

afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); vi.clearAllMocks(); sessionStorage.clear(); });

function navegador() {
  vi.stubGlobal('window', new Proxy(window, { get: (target, key) => key === 'location' ? { hash: '', search: '', assign: mocks.assign } : Reflect.get(target, key) }));
}

it('login navega uma vez direto para Finanças após autenticar, sem push/refresh', async () => {
  navegador();
  render(<LoginPage />);
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'teste@example.test' } });
  fireEvent.change(screen.getByLabelText('Senha'), { target: { value: 'senha1234' } });
  fireEvent.click(screen.getByRole('button', { name: 'Entrar' }));
  await waitFor(() => expect(mocks.auth.signInWithPassword).toHaveBeenCalledOnce());
  expect(mocks.home.mock.invocationCallOrder[0]!).toBeLessThan(mocks.auth.signInWithPassword.mock.invocationCallOrder[0]!);
  await waitFor(() => expect(mocks.assign).toHaveBeenCalledWith('/financas'));
  expect(mocks.assign).toHaveBeenCalledOnce();
  expect(mocks.push).not.toHaveBeenCalled();
  expect(mocks.refresh).not.toHaveBeenCalled();
});

it('nova senha navega uma vez direto para Finanças no botão de sucesso', async () => {
  sessionStorage.setItem('meudia:recuperacao-senha', '1');
  navegador();
  render(<NovaSenhaPage />);
  const senha = await screen.findByLabelText('Nova senha');
  fireEvent.change(senha, { target: { value: 'senhaNova123' } });
  fireEvent.change(screen.getByLabelText('Confirmar nova senha'), { target: { value: 'senhaNova123' } });
  fireEvent.click(screen.getByRole('button', { name: 'Salvar nova senha' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Ir para o MeuDia' }));
  await waitFor(() => expect(mocks.assign).toHaveBeenCalledWith('/financas'));
  expect(mocks.assign).toHaveBeenCalledOnce();
  expect(mocks.push).not.toHaveBeenCalled();
  expect(mocks.refresh).not.toHaveBeenCalled();
});

it.each(['rede', '429'])('login funciona se destinoAposAuth rejeitar: %s', async (erro) => {
  mocks.home.mockRejectedValueOnce(new Error(erro));
  navegador();
  render(<LoginPage />);
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'teste@example.test' } });
  fireEvent.change(screen.getByLabelText('Senha'), { target: { value: 'senha1234' } });
  fireEvent.click(screen.getByRole('button', { name: 'Entrar' }));
  await waitFor(() => expect(mocks.auth.signInWithPassword).toHaveBeenCalledOnce());
  await waitFor(() => expect(mocks.assign).toHaveBeenCalledWith('/inicio'));
  expect(mocks.assign).toHaveBeenCalledOnce();
});

it('nova senha usa /inicio quando destinoAposAuth rejeita', async () => {
  mocks.home.mockRejectedValueOnce(new Error('429'));
  sessionStorage.setItem('meudia:recuperacao-senha', '1');
  navegador();
  render(<NovaSenhaPage />);
  fireEvent.change(await screen.findByLabelText('Nova senha'), { target: { value: 'senhaNova123' } });
  fireEvent.change(screen.getByLabelText('Confirmar nova senha'), { target: { value: 'senhaNova123' } });
  fireEvent.click(screen.getByRole('button', { name: 'Salvar nova senha' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Ir para o MeuDia' }));
  await waitFor(() => expect(mocks.assign).toHaveBeenCalledWith('/inicio'));
  expect(mocks.assign).toHaveBeenCalledOnce();
});

it('login limita a descoberta sem resposta a 2,5 segundos', async () => {
  mocks.home.mockReturnValueOnce(new Promise(() => {}));
  navegador();
  render(<LoginPage />);
  vi.useFakeTimers();
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'teste@example.test' } });
  fireEvent.change(screen.getByLabelText('Senha'), { target: { value: 'senha1234' } });
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Entrar' })); });
  await act(async () => { await vi.advanceTimersByTimeAsync(2499); });
  expect(mocks.auth.signInWithPassword).not.toHaveBeenCalled();
  await act(async () => { await vi.advanceTimersByTimeAsync(1); });
  expect(mocks.auth.signInWithPassword).toHaveBeenCalledOnce();
  expect(mocks.assign).toHaveBeenCalledOnce();
  expect(mocks.assign).toHaveBeenCalledWith('/inicio');
  expect(screen.getByRole('button', { name: 'Entrar' }).hasAttribute('disabled')).toBe(false);
});

it('nova senha limita a descoberta sem resposta e desabilita o botão enquanto espera', async () => {
  mocks.home.mockReturnValueOnce(new Promise(() => {}));
  sessionStorage.setItem('meudia:recuperacao-senha', '1');
  navegador();
  render(<NovaSenhaPage />);
  fireEvent.change(await screen.findByLabelText('Nova senha'), { target: { value: 'senhaNova123' } });
  fireEvent.change(screen.getByLabelText('Confirmar nova senha'), { target: { value: 'senhaNova123' } });
  fireEvent.click(screen.getByRole('button', { name: 'Salvar nova senha' }));
  const botao = await screen.findByRole('button', { name: 'Ir para o MeuDia' });
  vi.useFakeTimers();
  await act(async () => { fireEvent.click(botao); });
  const desabilitadoDuranteEspera = botao.hasAttribute('disabled');
  await act(async () => { await vi.advanceTimersByTimeAsync(2499); });
  expect(mocks.assign).not.toHaveBeenCalled();
  await act(async () => { await vi.advanceTimersByTimeAsync(1); });
  expect(mocks.assign).toHaveBeenCalledOnce();
  expect(mocks.assign).toHaveBeenCalledWith('/inicio');
  expect(desabilitadoDuranteEspera).toBe(true);
  expect(botao.hasAttribute('disabled')).toBe(false);
});
