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
});

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

  it('modo padrão: sem hamburger (comportamento atual)', () => {
    renderTopbar('padrao');
    expect(screen.queryByRole('button', { name: 'Abrir menu' })).toBeNull();
  });
});
