// @vitest-environment jsdom
import { useState } from 'react';
import { afterEach, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { SeletorCarteira } from '../SeletorCarteira';
import { SeletorCategoria } from '../SeletorCategoria';
afterEach(cleanup);
function Seletor({ categoria = false }) {
  const [value, setValue] = useState(categoria ? 'Mercado' : 'a');
  return categoria ? <SeletorCategoria value={value} onChange={setValue} /> : <SeletorCarteira id="c" label="Banco" value={value} onChange={setValue} desabilitada="b" carteiras={[
    { id: 'a', nome: 'A', tipo: 'banco' }, { id: 'b', nome: 'B', tipo: 'banco' }, { id: 'c', nome: 'C', tipo: 'dinheiro' },
  ]} />;
}
it.each([false, true])('roving tabindex, setas, Home/End e ativação (categoria=%s)', (categoria) => {
  render(<Seletor categoria={categoria} />);
  const radios = screen.getAllByRole('radio') as HTMLButtonElement[];
  const habilitados = radios.filter((r) => !r.disabled);
  expect(radios.filter((r) => r.tabIndex === 0)).toHaveLength(1);
  habilitados[0]!.focus();
  for (const tecla of ['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp', 'End', 'Home']) {
    const atual = habilitados.indexOf(document.activeElement as HTMLButtonElement);
    const indice = tecla === 'Home' ? 0 : tecla === 'End' ? habilitados.length - 1 : (atual + (['ArrowLeft', 'ArrowUp'].includes(tecla) ? -1 : 1) + habilitados.length) % habilitados.length;
    fireEvent.keyDown(document.activeElement!, { key: tecla });
    expect(document.activeElement).toBe(habilitados[indice]);
    expect(habilitados[indice]!.getAttribute('aria-checked')).toBe('true');
    expect(habilitados[indice]!.tabIndex).toBe(0);
  }
  for (const key of ['Enter', ' ']) {
    habilitados.at(-1)!.focus();
    fireEvent.keyDown(document.activeElement!, { key });
    expect(habilitados.at(-1)!.getAttribute('aria-checked')).toBe('true');
  }
});
