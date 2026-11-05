// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { LinkAcao, Subabas, VazioCaderno } from '../index';

vi.mock('next/navigation', () => ({ usePathname: () => '/saude/peso' }));
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => <a href={href} {...rest}>{children}</a>,
}));

afterEach(cleanup);

describe('LinkAcao (QA R1: "editar" virava "edit ar" no Chromium 390)', () => {
  it('DM Sans do next/font, letter-spacing normal e sem quebra no meio da palavra', () => {
    render(<LinkAcao onClick={vi.fn()}>editar</LinkAcao>);
    const link = screen.getByRole('button', { name: 'editar' });
    expect(link.className).toContain('font-dm');
    expect(link.className).toContain('tracking-normal');
    expect(link.className).toContain('whitespace-nowrap');
    expect(link.className).toContain('[text-rendering:geometricPrecision]');
    expect(link.className).not.toMatch(/font-syne|tracking-\[/);
  });

  it('Treino usa o mesmo LinkAcao do Caderno', async () => {
    const treino = await import('../../treinos/ExercicioCaderno');
    expect(treino.LinkAcao).toBe(LinkAcao);
  });
});

describe('TelaCaderno', () => {
  it('raiz do módulo com a DM Sans do next/font e geometricPrecision (sem buraco no meio da palavra)', async () => {
    const { TelaCaderno } = await import('../index');
    const { container } = render(<TelaCaderno><p>Anterior</p></TelaCaderno>);
    expect((container.firstChild as HTMLElement).className).toMatch(/font-dm .*\[text-rendering:geometricPrecision\]/);
  });
});

describe('VazioCaderno (tela 08)', () => {
  it('rótulo, uma frase, uma linha de explicação e o botão cheio --accent3; sem ícone nem gradiente', () => {
    const onAcao = vi.fn();
    const { container } = render(
      <VazioCaderno rotulo="Peso" titulo="Nenhum peso ainda." explicacao="O gráfico aparece depois do primeiro registro." acao="Registrar peso de hoje" onAcao={onAcao} />,
    );
    expect(screen.getByText('Peso')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Nenhum peso ainda.' })).toBeTruthy();
    expect(screen.getByText('O gráfico aparece depois do primeiro registro.')).toBeTruthy();
    const botao = screen.getByRole('button', { name: 'Registrar peso de hoje' });
    expect(botao.className).toContain('bg-accent3');
    fireEvent.click(botao);
    expect(onAcao).toHaveBeenCalled();
    expect(container.innerHTML).not.toMatch(/gradient|<svg/);
  });

  it('ação como link quando recebe href', () => {
    render(<VazioCaderno rotulo="Treino de hoje" titulo="Nenhum treino hoje." explicacao="Monte o treino do dia na aba Treino." acao="Montar treino" href="/treinos" />);
    expect(screen.getByRole('link', { name: 'Montar treino' }).getAttribute('href')).toBe('/treinos');
  });
});

describe('Subabas Hoje · Treino · Dieta · Peso', () => {
  it('quatro abas, ativa pela rota com aria-current', () => {
    render(<Subabas />);
    const links = screen.getAllByRole('link');
    expect(links.map((l) => [l.textContent, l.getAttribute('href')])).toEqual([
      ['Hoje', '/saude'], ['Treino', '/treinos'], ['Dieta', '/saude/dieta'], ['Peso', '/saude/peso'],
    ]);
    expect(screen.getByRole('link', { name: 'Peso' }).getAttribute('aria-current')).toBe('page');
    expect(screen.getByRole('link', { name: 'Hoje' }).getAttribute('aria-current')).toBeNull();
  });
});
