// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { LinhaRendaAReceber } from '../CardRendaAReceber';

afterEach(cleanup);

const renda = { rendaId: 'r', descricao: 'Renda principal', valor: 2200, data: '2026-11-05', competencia: '2026-11' };

describe('LinhaRendaAReceber (Contas a vencer, 390/360px)', () => {
  it('texto inteiro, quebra sem limite de linhas nem truncate; Recebi não encolhe e tem ≥ 44px', () => {
    render(<ul><LinhaRendaAReceber renda={renda} hojeISO="2026-11-20" onRecebi={vi.fn()} /></ul>);
    const bloco = screen.getByTestId('renda-a-receber-texto');
    const [titulo, nota] = Array.from(bloco.querySelectorAll('p'));
    expect(titulo!.textContent).toBe('A receber: Renda principal dia 5');
    expect(nota!.textContent).toMatch(/^R\$\s2\.200,00 · era para cair em 05\/11$/);
    for (const p of [titulo!, nota!]) {
      expect(p.className).not.toMatch(/\btruncate\b|\btext-ellipsis\b|\bwhitespace-nowrap\b/);
      // Sem limite de linhas: descrição longa (até 500 caracteres) quebra e nunca some.
      expect(p.className).not.toMatch(/\bline-clamp-\d\b/);
      expect(p.className).toMatch(/\bbreak-words\b/);
    }
    const recebi = screen.getByRole('button', { name: 'Recebi Renda principal' });
    expect(recebi.className).toMatch(/\bshrink-0\b/);
    expect(recebi.className).toMatch(/\bmin-h-\[44px\]/);
    expect(recebi.className).toMatch(/\bmin-w-\[44px\]/);
  });
});
