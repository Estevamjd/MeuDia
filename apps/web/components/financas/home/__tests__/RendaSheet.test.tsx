// @vitest-environment jsdom
import { useEffect, useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { RendaSheet } from '../RendaSheet';

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const passarAutofoco = () => act(() => vi.advanceTimersByTime(150));

/** Como a home: o pai re-renderiza (refetch, etc.) e recria `onClose` inline. */
function Home() {
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 50);
    return () => clearInterval(id);
  }, []);
  return <RendaSheet open onClose={() => {}} onSalvar={() => {}} />;
}

describe('RendaSheet — foco', () => {
  it('Valor e Dia mantêm o foco e os valores com o pai re-renderizando', () => {
    render(<Home />);
    passarAutofoco();
    const valor = screen.getByLabelText('Valor') as HTMLInputElement;
    const dia = screen.getByLabelText('Dia que recebe (opcional)') as HTMLInputElement;
    expect(document.activeElement).toBe(valor);

    fireEvent.change(valor, { target: { value: '480000' } });
    passarAutofoco();
    expect(document.activeElement).toBe(valor);
    expect(valor.value.replace(/\s/g, ' ')).toBe('R$ 4.800,00');

    act(() => dia.focus());
    fireEvent.change(dia, { target: { value: '5' } });
    passarAutofoco();
    expect(document.activeElement).toBe(dia);
    expect(dia.value).toBe('5');
    expect(valor.value.replace(/\s/g, ' ')).toBe('R$ 4.800,00');
  });
});
