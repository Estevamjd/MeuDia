// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { AparenciaTema } from '../AparenciaTema';
import { CHAVE_TEMA } from '../../../lib/tema';

const m = vi.hoisted(() => ({ updateUser: vi.fn(), user: null as null | { id: string; user_metadata: Record<string, unknown> } }));
vi.mock('../../../lib/supabase/client', () => ({ createClient: () => ({ auth: { updateUser: m.updateUser } }) }));
vi.mock('../../../hooks/useAuth', () => ({ useAuth: () => ({ user: m.user }) }));

beforeEach(() => {
  localStorage.clear();
  document.documentElement.dataset.mode = 'dark';
  m.updateUser.mockReset().mockResolvedValue({ data: {}, error: null });
  m.user = null;
  vi.stubGlobal('matchMedia', (q: string) => ({ matches: q.includes('dark'), addEventListener() {}, removeEventListener() {} }));
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

it('começa no Escuro (padrão) e troca para Claro na hora, salvando no aparelho e na conta', () => {
  render(<AparenciaTema />);
  expect(screen.getByRole('radio', { name: 'Escuro' })).toHaveProperty('ariaChecked', 'true');
  fireEvent.click(screen.getByRole('radio', { name: 'Claro' }));
  expect(document.documentElement.dataset.mode).toBe('light');
  expect(localStorage.getItem(CHAVE_TEMA)).toBe('claro');
  expect(m.updateUser).toHaveBeenCalledWith({ data: { tema: 'claro' } });
  expect(screen.getByRole('radio', { name: 'Claro' })).toHaveProperty('ariaChecked', 'true');
});

it('Sistema segue o celular e explica isso', () => {
  render(<AparenciaTema />);
  fireEvent.click(screen.getByRole('radio', { name: 'Sistema' }));
  expect(document.documentElement.dataset.mode).toBe('dark');
  expect(screen.getByText(/Segue o modo claro ou escuro do seu celular/)).toBeTruthy();
});

it('falha ao salvar na conta não desfaz a escolha', async () => {
  m.updateUser.mockRejectedValue(new Error('offline'));
  render(<AparenciaTema />);
  fireEvent.click(screen.getByRole('radio', { name: 'Claro' }));
  await Promise.resolve();
  expect(document.documentElement.dataset.mode).toBe('light');
});

it('ao entrar, o tema salvo na conta vence o do aparelho', async () => {
  const { useSincronizarTema } = await import('../../../hooks/useTema');
  localStorage.setItem(CHAVE_TEMA, 'escuro');
  m.user = { id: 'u', user_metadata: { tema: 'claro' } };
  renderHook(() => useSincronizarTema());
  expect(localStorage.getItem(CHAVE_TEMA)).toBe('claro');
  expect(document.documentElement.dataset.mode).toBe('light');
});
