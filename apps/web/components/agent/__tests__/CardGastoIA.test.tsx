// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { hojeSP } from '@meudia/shared';
import { CardGastoIA } from '../CardGastoIA';
import type { PropostaGasto } from '../../../lib/ia/proposta';

const gasteiMutate = vi.fn();
const estado = {
  carteiras: [
    { id: 'c-arq', nome: 'Antiga', tipo: 'banco', arquivada: true },
    { id: 'c1', nome: 'Banco Teste', tipo: 'banco', arquivada: false },
    { id: 'c2', nome: 'Carteira', tipo: 'dinheiro', arquivada: false },
  ] as { id: string; nome: string; tipo: string; arquivada: boolean }[],
  carregando: false,
  padrao: 'c2' as string | null,
};
vi.mock('next/link', () => ({ default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a> }));
vi.mock('../../../hooks', () => ({
  useCarteiras: () => ({ data: estado.carregando ? undefined : estado.carteiras, isLoading: estado.carregando }),
  usePainelSaldo: () => ({ data: { carteiraPadraoId: estado.padrao } }),
  useGastei: () => ({ mutate: gasteiMutate, isPending: false }),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  estado.carregando = false;
  estado.padrao = 'c2';
});

const hoje = hojeSP();
const proposta: PropostaGasto = { valor: 45, categoria: 'Mercado', descricao: 'Mercado', data: hoje, carteira_id: null };

const renderCard = (p = proposta) => {
  const onConfirmado = vi.fn();
  const onCancelado = vi.fn();
  render(<CardGastoIA proposta={p} onConfirmado={onConfirmado} onCancelado={onCancelado} />);
  return { onConfirmado, onCancelado };
};

describe('CardGastoIA', () => {
  it('mostra R$ 45,00 / Mercado / Hoje e a carteira padrão; nada é gravado só por aparecer', () => {
    renderCard();
    expect(screen.getByTestId('ia-valor').textContent).toMatch(/R\$\s*45,00/);
    expect(screen.getByTestId('ia-categoria').textContent).toBe('Mercado');
    expect(screen.getByTestId('ia-data').textContent).toBe('Hoje');
    expect(screen.getByText('Carteira')).toBeTruthy();
    expect(gasteiMutate).not.toHaveBeenCalled();
  });

  it('Cancelar não grava', () => {
    const { onCancelado } = renderCard();
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(onCancelado).toHaveBeenCalledTimes(1);
    expect(gasteiMutate).not.toHaveBeenCalled();
  });

  it('Confirmar grava pelo "Gastei" existente, com a carteira padrão ativa', () => {
    const { onConfirmado } = renderCard();
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }));
    expect(gasteiMutate).toHaveBeenCalledTimes(1);
    expect(gasteiMutate.mock.calls[0]![0]).toEqual({ valor: 45, categoria: 'Mercado', descricao: 'Mercado', carteira_id: 'c2', data: hoje });
    gasteiMutate.mock.calls[0]![1].onSuccess();
    expect(onConfirmado.mock.calls[0]![0]).toMatch(/Gasto salvo: R\$\s*45,00 em Mercado \(Carteira\)/);
  });

  it('usa a carteira proposta quando é ativa; padrão arquivado cai na primeira ativa', () => {
    estado.padrao = 'c-arq';
    renderCard({ ...proposta, carteira_id: 'c1' });
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }));
    expect(gasteiMutate.mock.calls[0]![0].carteira_id).toBe('c1');
    cleanup();
    renderCard();
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }));
    expect(gasteiMutate.mock.calls[1]![0].carteira_id).toBe('c1');
  });

  it('Editar troca valor e categoria antes de confirmar', () => {
    renderCard();
    fireEvent.click(screen.getByRole('button', { name: 'Editar' }));
    fireEvent.change(screen.getByLabelText('Valor'), { target: { value: '5250' } });
    fireEvent.change(screen.getByLabelText('Categoria'), { target: { value: 'Comida' } });
    fireEvent.change(screen.getByLabelText('Saiu de'), { target: { value: 'c1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }));
    expect(gasteiMutate.mock.calls[0]![0]).toMatchObject({ valor: 52.5, categoria: 'Comida', carteira_id: 'c1' });
  });

  it('valor zerado na edição não grava', () => {
    renderCard();
    fireEvent.click(screen.getByRole('button', { name: 'Editar' }));
    fireEvent.change(screen.getByLabelText('Valor'), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }));
    expect(gasteiMutate).not.toHaveBeenCalled();
    expect(screen.getByRole('alert').textContent).toMatch(/maior que zero/);
  });

  it('erro ao salvar mantém o card com aviso', () => {
    const { onConfirmado } = renderCard();
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }));
    act(() => gasteiMutate.mock.calls[0]![1].onError());
    expect(onConfirmado).not.toHaveBeenCalled();
    expect(screen.getByRole('alert').textContent).toMatch(/Não foi possível salvar/);
    expect(screen.getByTestId('card-gasto-ia')).toBeTruthy();
  });

  it('sem carteira ativa: Confirmar desabilitado e link para cadastrar; enquanto carrega também desabilita', () => {
    const antes = estado.carteiras;
    estado.carteiras = [antes[0]!];
    renderCard();
    expect((screen.getByRole('button', { name: 'Confirmar' }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText('Adicionar banco ou carteira').getAttribute('href')).toBe('/financas/carteiras?nova=1');
    estado.carteiras = antes;
    cleanup();
    estado.carregando = true;
    renderCard();
    expect((screen.getByRole('button', { name: 'Confirmar' }) as HTMLButtonElement).disabled).toBe(true);
  });
});
