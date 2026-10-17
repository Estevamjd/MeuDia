// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { UltimosLancamentos } from '../UltimosLancamentos';
import type { Transacao } from '@meudia/shared';
afterEach(cleanup);
it.each(['recebimento', 'pagamento'] as const)('oferece Desfazer %s em vez de editar/excluir', (tipo) => {
  const desfazer = vi.fn(); const excluir = vi.fn();
  render(<UltimosLancamentos transacoes={[{ id: 't', descricao: 'Salário', tipo: 'receita', categoria: 'Salário', valor: 100, data: '2026-10-17' } as Transacao]} vinculos={{ t: tipo }} onDesfazer={desfazer} expandido onAlternarExpandido={vi.fn()} onNovo={vi.fn()} onEditar={vi.fn()} onExcluir={excluir} />);
  expect(screen.queryByRole('button', { name: /Editar lançamento|Excluir lançamento/ })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: `Desfazer ${tipo} Salário` }));
  expect(desfazer).toHaveBeenCalledWith(expect.objectContaining({ id: 't' }));
  expect(excluir).not.toHaveBeenCalled();
});
