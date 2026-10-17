// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { RecebiSheet } from '../RecebiSheet';
afterEach(cleanup);

const renda = { rendaId: 'r1', competencia: '2026-10', descricao: 'Salário', valor: 900, data: '2026-10-05' } as never;
const carteiras = [{ id: 'nu', nome: 'Nubank', tipo: 'banco' as const }, { id: 'cx', nome: 'Caixa', tipo: 'dinheiro' as const }];

it.each([['arquivada', 'nu'], ['cx', 'cx'], [null, 'nu']])('padrão %s: confirma sempre com carteira ativa (%s)', (padrao, esperada) => {
  const onConfirmar = vi.fn();
  render(<RecebiSheet renda={renda} carteiras={carteiras} carteiraPadrao={padrao} salvando={false} onClose={vi.fn()} onConfirmar={onConfirmar} />);
  expect(screen.getByRole('radio', { checked: true }).textContent).toBe(esperada === 'nu' ? 'Nubank' : 'Caixa');
  fireEvent.click(screen.getByRole('button', { name: /Confirmar/ }));
  expect(onConfirmar).toHaveBeenCalledWith(esperada);
});

it('sem carteira ativa: confirma sem carteira', () => {
  const onConfirmar = vi.fn();
  render(<RecebiSheet renda={renda} carteiras={[]} carteiraPadrao="arquivada" salvando={false} onClose={vi.fn()} onConfirmar={onConfirmar} />);
  fireEvent.click(screen.getByRole('button', { name: /Confirmar/ }));
  expect(onConfirmar).toHaveBeenCalledWith(null);
});
