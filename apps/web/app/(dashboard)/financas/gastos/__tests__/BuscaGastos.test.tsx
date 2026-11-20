// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import GastosPage from '../page';

const ok = <T,>(data: T) => ({ data, isLoading: false, isPending: false, isError: false, isSuccess: true, refetch: vi.fn() });

const tx = (id: string, descricao: string, categoria: string, data: string, origem: 'app' | 'whatsapp' = 'app', valor = 10) => ({
  id, user_id: 'u', tipo: 'despesa', categoria, descricao, valor, data, banco: 'Nubank', carteira_id: 'nu', ajuste: false,
  automatico: false, origem, created_at: `${data}T12:00:00Z`,
});
const TRANSACOES = [
  tx('a', 'Pão de Açúcar', 'Mercado', '2026-11-18', 'app', 120),
  tx('b', 'Uber pro trabalho', 'Transporte', '2026-11-17', 'whatsapp', 25),
  tx('c', 'Almoço', 'Restaurante', '2026-11-16', 'whatsapp', 40),
  // Outro mês: a busca nunca alcança (escopo = mês escolhido, sem consulta nova).
  tx('d', 'Uber de outubro', 'Transporte', '2026-10-30', 'whatsapp', 30),
];

const nav = vi.hoisted(() => ({ params: '', replace: vi.fn() }));
const consultas = vi.hoisted(() => ({ transacoesMes: vi.fn() }));
vi.mock('next/dynamic', () => ({ default: () => () => null }));
vi.mock('@meudia/shared', async (orig) => ({ ...(await orig<Record<string, unknown>>()), hojeSP: () => '2026-11-20' }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: nav.replace, push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(nav.params),
}));
vi.mock('../../../../../hooks', () => ({
  useTransacoesMes: (...a: unknown[]) => { consultas.transacoesMes(...a); return ok(TRANSACOES); },
  useContasMes: () => ok([]),
  usePainelSaldo: () => ok(undefined),
  useResumoFinanceiroMes: () => ok(undefined),
  useHistoricoSaldoMes: () => ok(undefined),
}));
vi.mock('../../../../../components/financas/useExclusaoLancamento', () => ({
  useExclusaoLancamento: () => ({ vinculos: {}, bloqueadas: false, pedirExclusao: vi.fn(), exclusao: null }),
}));
vi.mock('../../../../../components/financas/LancamentoModais', () => ({
  useLancamentoModais: () => ({ abrirEdicao: vi.fn(), abrirNovo: vi.fn(), modais: null }),
}));
vi.mock('../../../../../components/financas/LancamentoRapidoSheet', () => ({ LancamentoRapidoSheet: () => null }));
vi.mock('../../../../../components/financas/ConfirmarExclusao', () => ({ ConfirmarExclusao: () => null }));
vi.mock('../../../../../components/financas/usePagamentoAcoes', () => ({ usePagamentoAcoes: () => ({ desfazerPagamento: vi.fn(), contaOcupada: null }) }));

const descricoes = () => screen.queryAllByRole('listitem').map((li) => li.querySelector('p')?.textContent);
const campo = () => screen.getByRole('searchbox', { name: 'Buscar gasto' }) as HTMLInputElement;
/** A URL que o router.replace recebeu vira a URL atual (como o Next faz) e a página re-renderiza. */
const seguirUrl = (rerender: () => void) => {
  const href = nav.replace.mock.calls.at(-1)![0] as string;
  nav.params = href.split('?')[1] ?? '';
  rerender();
  return href;
};

beforeEach(() => {
  vi.useFakeTimers();
  nav.params = '';
  nav.replace.mockReset();
  consultas.transacoesMes.mockClear();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('Gastos: busca e "Só WhatsApp"', () => {
  it('campo de busca type=search e o chip "Só WhatsApp" (aria-pressed), com 44px de toque', () => {
    render(<GastosPage />);
    expect(campo().type).toBe('search');
    expect(campo().className).toContain('min-h-[44px]');
    const chip = screen.getByRole('button', { name: 'Só WhatsApp' });
    expect(chip.getAttribute('aria-pressed')).toBe('false');
    expect(chip.className).toContain('min-h-[44px]');
    expect(descricoes()).toEqual(['Pão de Açúcar', 'Uber pro trabalho', 'Almoço']);
  });

  it('digitar espera 200 ms sem tecla e só então troca a URL (replace, sem rolar); a lista filtra sem acento/maiúscula', () => {
    const { rerender } = render(<GastosPage />);
    fireEvent.change(campo(), { target: { value: 'pao' } });
    act(() => vi.advanceTimersByTime(150));
    fireEvent.change(campo(), { target: { value: 'pao de acucar' } });
    act(() => vi.advanceTimersByTime(150));
    expect(nav.replace).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(60));
    expect(nav.replace).toHaveBeenCalledTimes(1);
    expect(nav.replace).toHaveBeenCalledWith('/financas/gastos?q=pao+de+acucar', { scroll: false });
    seguirUrl(() => rerender(<GastosPage />));
    expect(descricoes()).toEqual(['Pão de Açúcar']);
    expect(campo().value).toBe('pao de acucar');
    expect(screen.getByTestId('gastos-busca-escopo').textContent).toBe('Buscando só em novembro.');
    expect(screen.getByTestId('total-gastos').textContent?.replace(/\s/g, ' ')).toBe('R$ 120,00');
  });

  it('"Só WhatsApp" liga origem=whatsapp na URL e mostra só o que veio do assistente; a busca soma com ele', () => {
    const { rerender } = render(<GastosPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Só WhatsApp' }));
    expect(seguirUrl(() => rerender(<GastosPage />))).toBe('/financas/gastos?origem=whatsapp');
    expect(screen.getByRole('button', { name: 'Só WhatsApp' }).getAttribute('aria-pressed')).toBe('true');
    expect(descricoes()).toEqual(['Uber pro trabalho', 'Almoço']);
    fireEvent.change(campo(), { target: { value: 'uber' } });
    act(() => vi.advanceTimersByTime(200));
    expect(seguirUrl(() => rerender(<GastosPage />))).toBe('/financas/gastos?q=uber&origem=whatsapp');
    expect(descricoes()).toEqual(['Uber pro trabalho']);
  });

  it('abrir com ?q=…&origem=whatsapp na URL já filtra (ida e volta) e o mês continua o escolhido', () => {
    nav.params = 'mes=2026-11&q=almo%C3%A7o&origem=whatsapp';
    render(<GastosPage />);
    expect(campo().value).toBe('almoço');
    expect(descricoes()).toEqual(['Almoço']);
    // Uma consulta só, a do mês (a busca não pede nada novo à rede).
    expect(new Set(consultas.transacoesMes.mock.calls.map((c) => c.join('-')))).toEqual(new Set(['2026-11']));
  });

  it('nada encontrado: vazio amigável com "Limpar filtros", que tira busca, WhatsApp e categoria da URL (o campo esvazia)', () => {
    nav.params = 'q=uber%20de%20outubro&origem=whatsapp&categoria=Transporte';
    const { rerender } = render(<GastosPage />);
    const vazio = screen.getByTestId('gastos-busca-vazia');
    expect(vazio.textContent).toContain('Nada com “uber de outubro” pelo WhatsApp em novembro.');
    fireEvent.click(screen.getByRole('button', { name: 'Limpar filtros' }));
    expect(seguirUrl(() => rerender(<GastosPage />))).toBe('/financas/gastos');
    expect(campo().value).toBe('');
    expect(screen.queryByTestId('gastos-busca-vazia')).toBeNull();
    expect(descricoes()).toHaveLength(3);
  });

  it('digitar e tocar "Limpar filtros" antes dos 200 ms (q da URL vazio, só WhatsApp ligado): a busca pendente não volta', () => {
    nav.params = 'origem=whatsapp&categoria=Mercado';
    const { rerender } = render(<GastosPage />);
    expect(screen.getByTestId('gastos-busca-vazia')).toBeTruthy();
    fireEvent.change(campo(), { target: { value: 'uber' } });
    act(() => vi.advanceTimersByTime(100));
    fireEvent.click(screen.getByRole('button', { name: 'Limpar filtros' }));
    expect(seguirUrl(() => rerender(<GastosPage />))).toBe('/financas/gastos');
    expect(campo().value).toBe('');
    act(() => vi.advanceTimersByTime(1000));
    // Só a navegação do "Limpar filtros"; o "uber" que estava no atraso foi descartado.
    expect(nav.replace).toHaveBeenCalledTimes(1);
    expect(descricoes()).toHaveLength(3);
  });

  it('digitar e trocar o mês antes dos 200 ms: o texto não enviado é descartado (o campo volta ao q da URL) e nada é reaplicado no mês novo', () => {
    nav.params = 'q=uber';
    const { rerender } = render(<GastosPage />);
    fireEvent.change(campo(), { target: { value: 'uber pro' } });
    act(() => vi.advanceTimersByTime(100));
    fireEvent.click(screen.getByRole('button', { name: 'Mês anterior' }));
    // O q comprometido (uber) segue no mês novo; o "uber pro" pendente, não.
    expect(seguirUrl(() => rerender(<GastosPage />))).toBe('/financas/gastos?mes=2026-10&q=uber');
    expect(campo().value).toBe('uber');
    act(() => vi.advanceTimersByTime(1000));
    expect(nav.replace).toHaveBeenCalledTimes(1);
  });

  it('voltar do navegador para outro mês com o mesmo q, com texto no atraso: o atraso é descartado', () => {
    nav.params = 'q=uber';
    const { rerender } = render(<GastosPage />);
    fireEvent.change(campo(), { target: { value: 'uber pro' } });
    act(() => vi.advanceTimersByTime(100));
    nav.params = 'mes=2026-10&q=uber';
    rerender(<GastosPage />);
    expect(campo().value).toBe('uber');
    act(() => vi.advanceTimersByTime(1000));
    expect(nav.replace).not.toHaveBeenCalled();
  });

  it('o X limpa na hora (sem esperar) e só aparece com texto', () => {
    nav.params = 'q=uber';
    const { rerender } = render(<GastosPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Limpar busca' }));
    expect(nav.replace).toHaveBeenCalledWith('/financas/gastos', { scroll: false });
    seguirUrl(() => rerender(<GastosPage />));
    expect(screen.queryByRole('button', { name: 'Limpar busca' })).toBeNull();
    // Nada atrasado depois.
    act(() => vi.advanceTimersByTime(500));
    expect(nav.replace).toHaveBeenCalledTimes(1);
  });

  it('busca de espaços não filtra nem vai para a URL; o select de categorias segue com as do mês inteiro', () => {
    const { rerender } = render(<GastosPage />);
    fireEvent.change(campo(), { target: { value: '   ' } });
    act(() => vi.advanceTimersByTime(200));
    expect(seguirUrl(() => rerender(<GastosPage />))).toBe('/financas/gastos');
    expect(descricoes()).toHaveLength(3);
    nav.params = 'q=uber';
    rerender(<GastosPage />);
    const opcoes = Array.from((screen.getByLabelText('Categoria') as HTMLSelectElement).options).map((o) => o.value);
    expect(opcoes).toEqual(['', 'Mercado', 'Restaurante', 'Transporte']);
  });
});
