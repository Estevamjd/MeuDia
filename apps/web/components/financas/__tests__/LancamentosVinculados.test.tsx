// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { LinhaLancamento } from '../LinhaLancamento';
import type { Transacao } from '@meudia/shared';
afterEach(cleanup);
it.each(['recebimento', 'pagamento'] as const)('vinculado a %s: só Excluir (vira desfazer na confirmação), sem editar', (tipo) => {
  const excluir = vi.fn();
  const t = { id: 't', descricao: 'Salário', tipo: 'receita', categoria: 'Salário', valor: 100, data: '2026-10-17' } as Transacao;
  render(<ul><LinhaLancamento t={t} vinculo={tipo} acoes={{ onEditar: vi.fn(), onExcluir: excluir }} /></ul>);
  expect(screen.queryByRole('button', { name: /Editar lançamento/ })).toBeNull();
  expect(screen.getByText(tipo === 'pagamento' ? 'Paguei' : 'Recebi')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Excluir lançamento Salário' }));
  expect(excluir).toHaveBeenCalledWith(t);
});
it('sem banco mostra "Sem banco"; Início (sem ações) não tem botões', () => {
  const t = { id: 'g', descricao: 'Feira', tipo: 'despesa', categoria: 'Mercado', valor: 50, data: '2026-10-02', banco: null, carteira_id: null } as Transacao;
  render(<ul><LinhaLancamento t={t} comCategoria /></ul>);
  expect(document.body.textContent?.replace(/\s/g, ' ')).toContain('Feira−R$ 50,00Mercado · 02/10 · Sem banco');
  expect(screen.queryByRole('button')).toBeNull();
});
it('editar e excluir têm alvo de toque ≥ 44×44 (h-11 w-11)', () => {
  const t = { id: 'g', descricao: 'Feira', tipo: 'despesa', categoria: 'Mercado', valor: 50, data: '2026-10-02', banco: 'Nubank' } as Transacao;
  render(<ul><LinhaLancamento t={t} acoes={{ onEditar: vi.fn(), onExcluir: vi.fn() }} /></ul>);
  for (const nome of ['Editar lançamento Feira', 'Excluir lançamento Feira']) {
    const classes = screen.getByRole('button', { name: nome }).className.split(/\s+/);
    expect(classes, nome).toEqual(expect.arrayContaining(['h-11', 'w-11']));
  }
});
