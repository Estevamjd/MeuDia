// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { InfoDica } from '../InfoDica';

afterEach(cleanup);

const montar = (onPai = vi.fn()) => {
  render(
    <div onClick={onPai} onPointerDown={onPai}>
      <p>fora</p>
      <InfoDica rotulo="Pode gastar por dia" texto="É o que deve sobrar dividido pelos dias." />
    </div>,
  );
  return { botao: screen.getByRole('button', { name: 'O que é Pode gastar por dia?' }), onPai };
};

describe('InfoDica', () => {
  it('fechado: aria-expanded=false, sem aria-controls nem caixa', () => {
    const { botao } = montar();
    expect(botao.getAttribute('aria-expanded')).toBe('false');
    expect(botao.hasAttribute('aria-controls')).toBe(false);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('clique abre a explicação (dialog no body, ligado por aria-controls) e outro clique fecha', () => {
    const { botao } = montar();
    fireEvent.click(botao);
    const caixa = screen.getByRole('dialog', { name: 'Pode gastar por dia' });
    expect(caixa.textContent).toContain('É o que deve sobrar dividido pelos dias.');
    expect(botao.getAttribute('aria-expanded')).toBe('true');
    expect(botao.getAttribute('aria-controls')).toBe(caixa.id);
    expect(caixa.parentElement).toBe(document.body);
    expect(document.activeElement).toBe(caixa);
    fireEvent.click(botao);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  // O Esc sai do elemento com foco (a caixa recebe o foco ao abrir), não do `document`: dispara nele.
  it('Esc com o foco na caixa fecha e devolve o foco ao ⓘ', () => {
    const { botao } = montar();
    fireEvent.click(botao);
    const caixa = screen.getByRole('dialog');
    expect(document.activeElement).toBe(caixa);
    fireEvent.keyDown(document.activeElement!, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(botao);
    expect(botao.getAttribute('aria-expanded')).toBe('false');
  });

  it('Esc com o foco no X (dentro da caixa) fecha e devolve o foco ao ⓘ', () => {
    const { botao } = montar();
    fireEvent.click(botao);
    const x = screen.getByRole('button', { name: 'Fechar explicação' });
    x.focus();
    expect(document.activeElement).toBe(x);
    fireEvent.keyDown(document.activeElement!, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(botao);
  });

  it('Esc com o foco no ⓘ (caixa aberta) fecha; o Esc não chega aos pais', () => {
    const onTecla = vi.fn();
    render(
      <div onKeyDown={onTecla}>
        <InfoDica rotulo="Meta" texto="Quanto você já guardou." />
      </div>,
    );
    const botao = screen.getByRole('button', { name: 'O que é Meta?' });
    fireEvent.click(botao);
    botao.focus();
    fireEvent.keyDown(document.activeElement!, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(botao);
    expect(onTecla).not.toHaveBeenCalled();
  });

  it('outras teclas dentro da caixa não fecham', () => {
    const { botao } = montar();
    fireEvent.click(botao);
    fireEvent.keyDown(document.activeElement!, { key: 'Tab' });
    fireEvent.keyDown(document.activeElement!, { key: 'Enter' });
    expect(screen.queryByRole('dialog')).not.toBeNull();
  });

  it('X fecha e devolve o foco ao ⓘ', () => {
    const { botao } = montar();
    fireEvent.click(botao);
    fireEvent.click(screen.getByRole('button', { name: 'Fechar explicação' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(botao);
  });

  it('toque fora fecha; toque dentro da caixa não', () => {
    montar();
    fireEvent.click(screen.getByRole('button', { name: /O que é/ }));
    fireEvent.pointerDown(screen.getByRole('dialog'));
    expect(screen.queryByRole('dialog')).not.toBeNull();
    act(() => {
      fireEvent.pointerDown(screen.getByText('fora'));
    });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('não deixa o toque/clique chegar aos pais (maço, links): React e DOM', () => {
    const { botao, onPai } = montar();
    const nativo = vi.fn();
    botao.parentElement!.addEventListener('pointerdown', nativo);
    fireEvent.pointerDown(botao);
    fireEvent.click(botao);
    fireEvent.click(screen.getByRole('dialog'));
    expect(onPai).not.toHaveBeenCalled();
    expect(nativo).not.toHaveBeenCalled();
  });

  it('área de toque de 44px pelo ::before (sem mexer no layout) e pan-y para não arrastar o maço', () => {
    const { botao } = montar();
    expect(botao.className).toContain('before:-inset-x-[15px]');
    expect(botao.className).toContain('before:-inset-y-[15px]');
    expect(botao.className).toContain('h-3.5');
    expect(botao.className).toContain('touch-pan-y');
    expect(botao.className).toContain('pointer-events-auto');
  });

  it('alvo nas linhas empilhadas: 44 de largura e a altura da linha (24), topo 44 e base 37', () => {
    const alvos = { linha: 'before:-inset-y-[5px]', 'linha-topo': 'before:-top-[25px] before:-bottom-[5px]', 'linha-base': 'before:-top-[5px] before:-bottom-[18px]' } as const;
    for (const [alvo, classe] of Object.entries(alvos)) {
      render(<InfoDica rotulo={alvo} texto="x" alvo={alvo as keyof typeof alvos} />);
      const b = screen.getByRole('button', { name: `O que é ${alvo}?` });
      expect(b.className, alvo).toContain(classe);
      expect(b.className, alvo).toContain('before:-inset-x-[15px]');
      expect(b.className, alvo).not.toContain('before:-inset-y-[15px]');
    }
  });
});
