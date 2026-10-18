// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { UltimosLancamentos } from '../UltimosLancamentos';
import type { Transacao } from '@meudia/shared';
afterEach(cleanup);
it.each(['recebimento', 'pagamento'] as const)('vinculado a %s: só Excluir (vira desfazer na confirmação), sem editar', (tipo) => {
  const excluir = vi.fn();
  const t = { id: 't', descricao: 'Salário', tipo: 'receita', categoria: 'Salário', valor: 100, data: '2026-10-17' } as Transacao;
  render(<UltimosLancamentos transacoes={[t]} vinculos={{ t: tipo }} expandido onAlternarExpandido={vi.fn()} onNovo={vi.fn()} onEditar={vi.fn()} onExcluir={excluir} />);
  expect(screen.queryByRole('button', { name: /Editar lançamento/ })).toBeNull();
  expect(screen.getByText(tipo === 'pagamento' ? 'Paguei' : 'Recebi')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Excluir lançamento Salário' }));
  expect(excluir).toHaveBeenCalledWith(t);
});
