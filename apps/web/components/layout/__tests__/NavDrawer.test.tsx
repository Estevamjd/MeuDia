// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { AppModeProvider } from '../../AppModeProvider';
import { Topbar } from '../Topbar';

let pathname = '/financas';
vi.mock('next/navigation', () => ({ usePathname: () => pathname }));

afterEach(() => {
  cleanup();
  pathname = '/financas';
  vi.unstubAllGlobals();
});

/** matchMedia controlável: `mudar(true)` simula a viewport passando para >= md. */
const mockMatchMedia = (inicial = false) => {
  const listeners = new Set<(e: MediaQueryListEvent) => void>();
  const mql = {
    matches: inicial,
    media: '(min-width: 768px)',
    addEventListener: (_: 'change', fn: (e: MediaQueryListEvent) => void) => listeners.add(fn),
    removeEventListener: (_: 'change', fn: (e: MediaQueryListEvent) => void) => listeners.delete(fn),
  };
  vi.stubGlobal('matchMedia', vi.fn(() => mql));
  return {
    listeners,
    mudar: (matches: boolean) => {
      mql.matches = matches;
      act(() => listeners.forEach((fn) => fn({ matches } as MediaQueryListEvent)));
    },
  };
};

const renderTopbar = (mode: 'financas' | 'padrao', onSignOut = vi.fn()) =>
  render(
    <AppModeProvider mode={mode} vapidPublicKey={null}>
      <Topbar onSignOut={onSignOut} />
    </AppModeProvider>,
  );

const abrir = () => {
  const botao = screen.getByRole('button', { name: 'Abrir menu' });
  fireEvent.click(botao);
  return botao;
};

describe('Drawer do Topbar (modo finanças)', () => {
  it('hamburger com aria-expanded/aria-controls; abre dialog modal com foco dentro', () => {
    renderTopbar('financas');
    const botao = screen.getByRole('button', { name: 'Abrir menu' });
    expect(botao.getAttribute('aria-expanded')).toBe('false');
    abrir();
    const dialog = screen.getByRole('dialog');
    expect(botao.getAttribute('aria-expanded')).toBe('true');
    expect(botao.getAttribute('aria-controls')).toBe(dialog.id);
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(dialog.contains(document.activeElement)).toBe(true);
  });

  it('só itens de finanças + Configurações e Sair', () => {
    renderTopbar('financas');
    abrir();
    const links = screen.getAllByRole('link').map((a) => a.getAttribute('href'));
    expect(links).toEqual(['/financas', '/financas/contas', '/financas/orcamento', '/assinaturas', '/configuracoes']);
    expect(screen.getByRole('button', { name: 'Sair' })).toBeTruthy();
  });

  it('Esc fecha e devolve o foco ao botão', () => {
    renderTopbar('financas');
    const botao = abrir();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(botao);
  });

  it('clique no overlay fecha', () => {
    renderTopbar('financas');
    abrir();
    fireEvent.click(screen.getByTestId('nav-drawer-overlay'));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('focus trap: Tab no último volta ao primeiro e Shift+Tab no primeiro vai ao último', () => {
    renderTopbar('financas');
    abrir();
    const dialog = screen.getByRole('dialog');
    const focaveis = dialog.querySelectorAll<HTMLElement>('a[href], button');
    const primeiro = focaveis[0]!;
    const ultimo = focaveis[focaveis.length - 1]!;
    ultimo.focus();
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(document.activeElement).toBe(primeiro);
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(ultimo);
  });

  it('fecha ao navegar', () => {
    const { rerender } = renderTopbar('financas');
    abrir();
    pathname = '/financas/contas';
    act(() => {
      rerender(
        <AppModeProvider mode="financas" vapidPublicKey={null}>
          <Topbar onSignOut={vi.fn()} />
        </AppModeProvider>,
      );
    });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('Sair fecha e chama onSignOut', () => {
    const onSignOut = vi.fn();
    renderTopbar('financas', onSignOut);
    abrir();
    fireEvent.click(screen.getByRole('button', { name: 'Sair' }));
    expect(onSignOut).toHaveBeenCalledOnce();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('viewport >= 768px com o drawer aberto: fecha e libera listener, focus trap e overflow', () => {
    const media = mockMatchMedia();
    renderTopbar('financas');
    abrir();
    expect(document.body.style.overflow).toBe('hidden');
    expect(media.listeners.size).toBe(1);

    media.mudar(true);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByRole('button', { name: 'Abrir menu' }).getAttribute('aria-expanded')).toBe('false');
    expect(document.body.style.overflow).toBe('');
    expect(media.listeners.size).toBe(0);
    // Sem focus trap: Tab não é mais interceptado.
    const tab = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
    document.dispatchEvent(tab);
    expect(tab.defaultPrevented).toBe(false);
  });

  it('abrir já em >= 768px fecha de imediato', () => {
    mockMatchMedia(true);
    renderTopbar('financas');
    abrir();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.body.style.overflow).toBe('');
  });

  it('modo padrão: sem hamburger (comportamento atual)', () => {
    renderTopbar('padrao');
    expect(screen.queryByRole('button', { name: 'Abrir menu' })).toBeNull();
  });
});
