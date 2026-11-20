// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, renderHook, screen, within } from '@testing-library/react';
import { AparenciaTema } from '../AparenciaTema';
import { CHAVE_TEMA } from '../../../lib/tema';
import { CHAVE_COR } from '../../../lib/cores-app';
import { redefinirCorAppParaTeste, useSincronizarTema } from '../../../hooks/useTema';

const m = vi.hoisted(() => ({ updateUser: vi.fn(), user: null as null | { id: string; user_metadata: Record<string, unknown> } }));
vi.mock('../../../lib/supabase/client', () => ({ createClient: () => ({ auth: { updateUser: m.updateUser } }) }));
vi.mock('../../../hooks/useAuth', () => ({ useAuth: () => ({ user: m.user }) }));

beforeEach(() => {
  localStorage.clear();
  document.documentElement.dataset.mode = 'dark';
  m.updateUser.mockReset().mockResolvedValue({ data: {}, error: null });
  m.user = null;
  redefinirCorAppParaTeste();
  vi.stubGlobal('matchMedia', (q: string) => ({ matches: q.includes('dark'), addEventListener() {}, removeEventListener() {} }));
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
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

describe('Cor do app', () => {
  beforeEach(() => document.documentElement.removeAttribute('data-accent'));

  it('começa no Ciano (sem atributo) e troca para Laranja na hora, salvando no aparelho e na conta', () => {
    render(<AparenciaTema />);
    const grupo = screen.getByRole('radiogroup', { name: 'Cor do app' });
    expect(within(grupo).getAllByRole('radio').map((r) => r.textContent)).toEqual(['Ciano', 'Laranja', 'Verde', 'Amarelo', 'Roxo', 'Rosa']);
    expect(within(grupo).getByRole('radio', { name: 'Ciano' })).toHaveProperty('ariaChecked', 'true');
    fireEvent.click(within(grupo).getByRole('radio', { name: 'Laranja' }));
    expect(document.documentElement.getAttribute('data-accent')).toBe('laranja');
    expect(localStorage.getItem(CHAVE_COR)).toBe('laranja');
    expect(m.updateUser).toHaveBeenCalledWith({ data: { cor_app: 'laranja' } });
    expect(within(grupo).getByRole('radio', { name: 'Laranja' })).toHaveProperty('ariaChecked', 'true');
    fireEvent.click(within(grupo).getByRole('radio', { name: 'Ciano' }));
    expect(document.documentElement.hasAttribute('data-accent')).toBe(false);
  });

  it('a bolinha mostra o tom do tema atual', () => {
    document.documentElement.dataset.mode = 'light';
    localStorage.setItem(CHAVE_TEMA, 'claro');
    render(<AparenciaTema />);
    const bolinha = screen.getByRole('radio', { name: 'Amarelo' }).querySelector('span') as HTMLElement;
    expect(bolinha.style.backgroundColor).toBe('rgb(143, 91, 5)');
  });

  it('ao entrar, a cor salva na conta vence a do aparelho; valor desconhecido é ignorado', async () => {
    const { useSincronizarTema } = await import('../../../hooks/useTema');
    localStorage.setItem(CHAVE_COR, 'verde');
    m.user = { id: 'u', user_metadata: { cor_app: 'rosa' } };
    const { rerender } = renderHook(() => useSincronizarTema());
    expect(localStorage.getItem(CHAVE_COR)).toBe('rosa');
    expect(document.documentElement.getAttribute('data-accent')).toBe('rosa');
    m.user = { id: 'u', user_metadata: { cor_app: 'azul' } };
    rerender();
    expect(localStorage.getItem(CHAVE_COR)).toBe('rosa');
  });

  /** Tela de Configurações com o sincronizador do DashboardShell; `ecoDaConta` simula o USER_UPDATED. */
  function telaComSincronizacao() {
    function Tela() {
      useSincronizarTema();
      return <AparenciaTema />;
    }
    const r = render(<Tela />);
    const grupo = screen.getByRole('radiogroup', { name: 'Cor do app' });
    const ecoDaConta = (cor: string) => {
      m.user = { id: 'u', user_metadata: { cor_app: cor } };
      r.rerender(<Tela />);
    };
    return { grupo, ecoDaConta };
  }

  it('resposta atrasada de uma escolha anterior não repinta a cor velha (Laranja e depois Rosa)', async () => {
    m.user = { id: 'u', user_metadata: {} };
    const respostas: Array<() => void> = [];
    m.updateUser.mockImplementation(() => new Promise((ok) => respostas.push(() => ok({ data: {}, error: null }))));
    const { grupo, ecoDaConta } = telaComSincronizacao();
    fireEvent.click(within(grupo).getByRole('radio', { name: 'Laranja' }));
    fireEvent.click(within(grupo).getByRole('radio', { name: 'Rosa' }));
    expect(document.documentElement.getAttribute('data-accent')).toBe('rosa');

    // A confirmação da Laranja chega com a Rosa ainda pendente.
    ecoDaConta('laranja');
    expect(document.documentElement.getAttribute('data-accent')).toBe('rosa');
    expect(localStorage.getItem(CHAVE_COR)).toBe('rosa');
    expect(within(grupo).getByRole('radio', { name: 'Rosa' })).toHaveProperty('ariaChecked', 'true');

    // Rosa confirma; depois a Laranja ainda chega atrasada de novo (fora de ordem).
    await act(async () => respostas[1]?.());
    ecoDaConta('rosa');
    await act(async () => respostas[0]?.());
    ecoDaConta('laranja');
    expect(document.documentElement.getAttribute('data-accent')).toBe('rosa');
    expect(localStorage.getItem(CHAVE_COR)).toBe('rosa');
    expect(within(grupo).getByRole('radio', { name: 'Rosa' })).toHaveProperty('ariaChecked', 'true');
  });

  it('cor de outra conta na mesma aba ainda vence (o eco velho é só da conta que escolheu)', () => {
    m.user = { id: 'u', user_metadata: {} };
    const { grupo } = telaComSincronizacao();
    fireEvent.click(within(grupo).getByRole('radio', { name: 'Laranja' }));
    m.user = { id: 'outra', user_metadata: { cor_app: 'verde' } };
    renderHook(() => useSincronizarTema());
    expect(document.documentElement.getAttribute('data-accent')).toBe('verde');
  });

  it('localStorage que recusa gravar e ler: a escolha vale na tela e no snapshot (não volta ao Ciano)', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('cota', 'QuotaExceededError');
    });
    const getItem = vi.spyOn(Storage.prototype, 'getItem');
    render(<AparenciaTema />);
    const grupo = screen.getByRole('radiogroup', { name: 'Cor do app' });
    getItem.mockImplementation(() => {
      throw new DOMException('bloqueado', 'SecurityError');
    });
    fireEvent.click(within(grupo).getByRole('radio', { name: 'Laranja' }));
    expect(document.documentElement.getAttribute('data-accent')).toBe('laranja');
    expect(within(grupo).getByRole('radio', { name: 'Laranja' })).toHaveProperty('ariaChecked', 'true');
    expect(within(grupo).getByRole('radio', { name: 'Ciano' })).toHaveProperty('ariaChecked', 'false');
  });

  it('localStorage que só recusa gravar (lê a cor antiga): o snapshot segue a escolha nova', () => {
    localStorage.setItem(CHAVE_COR, 'verde');
    document.documentElement.setAttribute('data-accent', 'verde');
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('cota', 'QuotaExceededError');
    });
    render(<AparenciaTema />);
    const grupo = screen.getByRole('radiogroup', { name: 'Cor do app' });
    fireEvent.click(within(grupo).getByRole('radio', { name: 'Roxo' }));
    expect(document.documentElement.getAttribute('data-accent')).toBe('roxo');
    expect(within(grupo).getByRole('radio', { name: 'Roxo' })).toHaveProperty('ariaChecked', 'true');
  });
});
