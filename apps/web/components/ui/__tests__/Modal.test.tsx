// @vitest-environment jsdom
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Modal } from '../Modal';

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const passarAutofoco = () => act(() => vi.advanceTimersByTime(150));

/** Pai que re-renderiza a cada tecla e passa `onClose` inline (como as telas reais). */
function Pai({ onFechar = () => {} }: { onFechar?: () => void }) {
  const [aberto, setAberto] = useState(true);
  const [nome, setNome] = useState('');
  const [valor, setValor] = useState('');
  return (
    <>
      <button onClick={() => setAberto(true)}>Abrir</button>
      <Modal
        isOpen={aberto}
        onClose={() => {
          onFechar();
          setAberto(false);
        }}
        title="Nova conta"
      >
        <label htmlFor="nome">Nome</label>
        <input id="nome" value={nome} onChange={(e) => setNome(e.target.value)} />
        <label htmlFor="valor">Valor</label>
        <input id="valor" value={valor} onChange={(e) => setValor(e.target.value)} />
      </Modal>
    </>
  );
}

describe('Modal', () => {
  it('autofoca o 1º campo uma vez; re-render do pai não devolve o foco para Nome', () => {
    render(<Pai />);
    passarAutofoco();
    const nome = screen.getByLabelText('Nome') as HTMLInputElement;
    const valor = screen.getByLabelText('Valor') as HTMLInputElement;
    expect(document.activeElement).toBe(nome);

    fireEvent.change(nome, { target: { value: 'Luz' } });
    passarAutofoco();
    expect(document.activeElement).toBe(nome);

    act(() => valor.focus());
    fireEvent.change(valor, { target: { value: '180' } });
    passarAutofoco();

    expect(document.activeElement).toBe(valor);
    expect(nome.value).toBe('Luz');
    expect(valor.value).toBe('180');
  });

  it('se o usuário foca outro campo antes do autofoco, mantém o foco dele', () => {
    render(<Pai />);
    const valor = screen.getByLabelText('Valor');
    act(() => valor.focus());
    passarAutofoco();
    expect(document.activeElement).toBe(valor);
  });

  it('Escape chama o onClose mais recente e devolve o foco a quem abriu', () => {
    const onFechar = vi.fn();
    render(<Pai onFechar={onFechar} />);
    passarAutofoco();
    fireEvent.change(screen.getByLabelText('Nome'), { target: { value: 'x' } });

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onFechar).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.body.style.overflow).toBe('');

    const abrir = screen.getByRole('button', { name: 'Abrir' });
    act(() => abrir.focus());
    fireEvent.click(abrir);
    expect(document.body.style.overflow).toBe('hidden');
    passarAutofoco();
    expect(document.activeElement).toBe(screen.getByLabelText('Nome'));

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(document.activeElement).toBe(abrir);
  });

  it('focus trap: Tab no último volta ao primeiro', () => {
    render(<Pai />);
    passarAutofoco();
    const valor = screen.getByLabelText('Valor');
    act(() => valor.focus());
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Fechar modal' }));
  });
});
