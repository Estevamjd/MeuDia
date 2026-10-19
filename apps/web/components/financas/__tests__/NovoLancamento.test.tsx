// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { Transacao } from '@meudia/shared';
import { useLancamentoModais } from '../LancamentoModais';
const m = vi.hoisted(() => ({
  criar: vi.fn(), atualizar: vi.fn(), carteiras: [] as unknown[],
  consulta: { isPending: false, isError: false, isSuccess: true },
  editar: null as Transacao | null,
}));
vi.mock('../../../hooks', () => ({
  useCarteiras: () => ({ data: m.consulta.isSuccess ? m.carteiras : undefined, ...m.consulta }),
  useCriarTransacao: () => ({ mutate: m.criar }), useAtualizarTransacao: () => ({ mutate: m.atualizar }),
}));
vi.mock('../../ui', async (original) => ({ ...await original<object>(), useToast: () => ({ success: vi.fn(), error: vi.fn() }) }));
/** A Início e Gastos usam o mesmo hook: botões de abrir + os modais. */
function Page() {
  const { abrirNovo, abrirEdicao, modais } = useLancamentoModais();
  return (
    <>
      <button onClick={abrirNovo}>Novo lançamento</button>
      <button onClick={() => abrirEdicao(m.editar!)}>Editar lançamento</button>
      {modais}
    </>
  );
}
afterEach(cleanup);
beforeEach(() => {
  vi.clearAllMocks();
  m.consulta = { isPending: false, isError: false, isSuccess: true };
});
const NUBANK = { id: 'nu', nome: 'Nubank', tipo: 'banco', arquivada: false };

function preencherNovo() {
  fireEvent.click(screen.getByRole('button', { name: 'Novo lançamento' }));
  const categoria = screen.getByPlaceholderText('Ex.: Alimentação, Transporte…');
  fireEvent.change(categoria, { target: { value: 'Mercado' } });
  fireEvent.change(screen.getByPlaceholderText('Descrição do lançamento'), { target: { value: 'Compra' } });
  fireEvent.change(screen.getByPlaceholderText('0,00'), { target: { value: '25' } });
  return categoria.closest('form')!;
}

it.each([false, true])('formulário envia carteira quando disponível (%s)', (temCarteira) => {
  m.carteiras = temCarteira ? [NUBANK] : [];
  render(<Page />);
  const form = preencherNovo();
  if (temCarteira) {
    expect(screen.getByRole('radio', { name: 'Nubank' }).getAttribute('aria-checked')).toBe('true');
    expect(screen.queryByPlaceholderText('Ex.: Nubank, Itaú…')).toBeNull();
  } else fireEvent.change(screen.getByPlaceholderText('Ex.: Nubank, Itaú…'), { target: { value: 'Legado' } });
  fireEvent.submit(form);
  expect(m.criar).toHaveBeenCalledWith(expect.objectContaining({ carteira_id: temCarteira ? 'nu' : undefined, banco: temCarteira ? 'Nubank' : 'Legado', valor: 25 }), expect.anything());
});

describe('consulta de carteiras', () => {
  it('falhou: Salvar continua habilitado e o lançamento cai no campo texto do banco', () => {
    m.consulta = { isPending: false, isError: true, isSuccess: false };
    render(<Page />);
    const form = preencherNovo();
    expect(screen.getByRole('button', { name: 'Salvar' }).hasAttribute('disabled')).toBe(false);
    fireEvent.change(screen.getByPlaceholderText('Ex.: Nubank, Itaú…'), { target: { value: 'Itaú' } });
    fireEvent.submit(form);
    expect(m.criar).toHaveBeenCalledWith(expect.objectContaining({ banco: 'Itaú', carteira_id: undefined }), expect.anything());
  });
  it('carregando: Salvar espera (não grava sem saber se há carteira)', () => {
    m.consulta = { isPending: true, isError: false, isSuccess: false };
    render(<Page />);
    preencherNovo();
    expect(screen.getByRole('button', { name: 'Salvar' }).hasAttribute('disabled')).toBe(true);
  });
});

describe('editar lançamento antigo (carteira_id NULL)', () => {
  const legado = {
    id: 't1', user_id: 'u', tipo: 'despesa', categoria: 'Mercado', descricao: 'Feira', valor: 40, data: '2026-09-02',
    banco: 'Itaú', automatico: false, created_at: '2026-09-02T12:00:00Z', carteira_id: null, ajuste: false,
  } as Transacao;
  beforeEach(() => {
    m.carteiras = [NUBANK];
    m.editar = legado;
  });
  it('mostra "Sem carteira" marcado e não mexe em carteira_id/banco se o usuário não trocou', () => {
    render(<Page />);
    fireEvent.click(screen.getByRole('button', { name: 'Editar lançamento' }));
    expect(screen.getByRole('radio', { name: 'Sem carteira' }).getAttribute('aria-checked')).toBe('true');
    expect(screen.getByRole('radio', { name: 'Nubank' }).getAttribute('aria-checked')).toBe('false');
    const valor = screen.getByPlaceholderText('0,00');
    fireEvent.change(valor, { target: { value: '45' } });
    fireEvent.submit(valor.closest('form')!);
    const payload = m.atualizar.mock.calls[0]![0].data;
    expect(payload).toMatchObject({ valor: 45 });
    expect(payload).not.toHaveProperty('carteira_id');
    expect(payload).not.toHaveProperty('banco');
  });
  it('escolher uma carteira vincula o lançamento a ela', () => {
    render(<Page />);
    fireEvent.click(screen.getByRole('button', { name: 'Editar lançamento' }));
    fireEvent.click(screen.getByRole('radio', { name: 'Nubank' }));
    fireEvent.submit(screen.getByPlaceholderText('0,00').closest('form')!);
    expect(m.atualizar.mock.calls[0]![0].data).toMatchObject({ carteira_id: 'nu', banco: 'Nubank' });
  });
  it('lançamento com carteira não ganha a opção "Sem carteira" e mantém a carteira', () => {
    m.editar = { ...legado, carteira_id: 'nu', banco: 'Nubank' };
    render(<Page />);
    fireEvent.click(screen.getByRole('button', { name: 'Editar lançamento' }));
    expect(screen.queryByRole('radio', { name: 'Sem carteira' })).toBeNull();
    expect(screen.getByRole('radio', { name: 'Nubank' }).getAttribute('aria-checked')).toBe('true');
    fireEvent.submit(screen.getByPlaceholderText('0,00').closest('form')!);
    expect(m.atualizar.mock.calls[0]![0].data).not.toHaveProperty('carteira_id');
  });
});
