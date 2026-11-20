// @vitest-environment jsdom
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ReactNode } from 'react';
import { act, cleanup, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider, onlineManager } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAtualizarTransacao, useCriarTransacao, useExcluirTransacao } from '../useFinancas';
import { useAtualizarTreino, useCriarTreino, useExcluirTreino, useRegistrarSerie } from '../useTreinos';
import { CHAVE_FILA_OFFLINE_LEGADA, limparFilaOfflineLegada } from '../useOnline';
import { ErroSemInternet, MENSAGEM_SEM_INTERNET } from '../useMutacao';
import { AppError } from '@meudia/shared';
import { OfflineIndicator } from '../../components/ui/OfflineIndicator';
import { ToastProvider } from '../../components/ui/Toast';
import { useLancamentoModais } from '../../components/financas/LancamentoModais';

// Contrato: a gravação sempre tenta o serviço (os sinais de conexão do navegador não vetam nada); sem rede ela
// falha NA HORA com "Sem internet" (toast de erro da tela) e nunca fica guardada para repetir depois. O React Query, por padrão (`networkMode: 'online'`), pausa a mutação offline e a executa quando a
// rede volta: era a fila offline escondida que este teste pega.
const api = vi.hoisted(() => ({
  criarTransacao: vi.fn(),
  atualizarTransacao: vi.fn(),
  excluirTransacao: vi.fn(),
  criarTreino: vi.fn(),
  atualizarTreino: vi.fn(),
  excluirTreino: vi.fn(),
  registrarSerie: vi.fn(),
}));
vi.mock('@meudia/api', () => ({
  financasService: {
    criarTransacao: api.criarTransacao,
    atualizarTransacao: api.atualizarTransacao,
    excluirTransacao: api.excluirTransacao,
  },
  treinoService: {
    criarTreino: api.criarTreino,
    atualizarTreino: api.atualizarTreino,
    excluirTreino: api.excluirTreino,
    registrarSerie: api.registrarSerie,
  },
  sessaoRepository: {},
}));
vi.mock('../useAuth', () => ({ useAuth: () => ({ user: { id: 'u1' }, loading: false }) }));
vi.mock('../useCarteiras', () => ({
  useCarteiras: () => ({ data: [], isPending: false, isError: false, isSuccess: true }),
}));
vi.mock('../../components/AppModeProvider', () => ({ useAppMode: () => 'financas' }));

let navegadorOnline = true;
beforeEach(() => {
  navegadorOnline = false;
  Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => navegadorOnline });
  localStorage.clear();
  // O serviço "funcionaria": se a mutação for repetida quando a rede voltar, o teste vê a chamada.
  for (const fn of Object.values(api)) fn.mockReset().mockResolvedValue({ id: 'gravado' });
  onlineManager.setOnline(false);
});
afterEach(() => {
  onlineManager.setOnline(true);
  navegadorOnline = true;
  cleanup();
});

function criarWrapper() {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

const PENDENTE = Symbol('pendente');
/** Resultado em até 50 ms: a mutação pausada pelo React Query nunca resolve nem rejeita. */
function emAte50ms(p: Promise<unknown>) {
  return Promise.race([
    p.then(
      (valor) => ({ ok: true as const, valor }),
      (erro: unknown) => ({ ok: false as const, erro }),
    ),
    new Promise<typeof PENDENTE>((r) => setTimeout(() => r(PENDENTE), 50)),
  ]);
}

/** Rede volta (evento do React Query + navegador) e dá tempo para uma mutação pausada ser retomada. */
async function voltarRede() {
  await act(async () => {
    navegadorOnline = true;
    onlineManager.setOnline(true);
    await new Promise((r) => setTimeout(r, 30));
  });
}

type Mutacao = () => { mutateAsync: (args: never) => Promise<unknown> };
const casos: [string, Mutacao, unknown, ReturnType<typeof vi.fn>][] = [
  ['useCriarTransacao', useCriarTransacao, { tipo: 'despesa', valor: 10 }, api.criarTransacao],
  ['useAtualizarTransacao', useAtualizarTransacao, { id: 'tx-1', data: { valor: 5 } }, api.atualizarTransacao],
  ['useExcluirTransacao', useExcluirTransacao, 'tx-1', api.excluirTransacao],
  ['useCriarTreino', useCriarTreino, { nome: 'A', dia_semana: 1 }, api.criarTreino],
  ['useAtualizarTreino', useAtualizarTreino, { id: 't-1', data: { nome: 'B' } }, api.atualizarTreino],
  ['useExcluirTreino', useExcluirTreino, 't-1', api.excluirTreino],
  ['useRegistrarSerie', useRegistrarSerie, { sessao_id: 's', exercicio_id: 'e' }, api.registrarSerie],
];

/** Erro de rede como chega do serviço: fetch cru ou embrulhado pelo supabase-js + `erroDb` (AppError com a mensagem). */
const errosDeRede: [string, () => unknown][] = [
  ['TypeError cru (Chrome)', () => new TypeError('Failed to fetch')],
  ['AppError do supabase-js (Safari)', () => new AppError('TypeError: Load failed', 'DB_ERROR', 500)],
  ['timeout do fetch', () => new DOMException('signal timed out', 'TimeoutError')],
];

describe('sinais de conexão não vetam a gravação (falso negativo do navegador)', () => {
  it.each(casos)('%s: React Query online + navigator.onLine false + serviço ok → grava, 1 chamada', async (_nome, hook, args, servico) => {
    onlineManager.setOnline(true);
    navegadorOnline = false;
    const { result } = renderHook(() => hook(), { wrapper: criarWrapper() });
    const mutateAsync = result.current.mutateAsync as (a: unknown) => Promise<unknown>;
    await act(async () => {
      await expect(mutateAsync(args)).resolves.toEqual({ id: 'gravado' });
    });
    expect(servico).toHaveBeenCalledTimes(1);
  });

  it('React Query offline + navigator.onLine true + serviço ok → grava, 1 chamada', async () => {
    onlineManager.setOnline(false);
    navegadorOnline = true;
    const { result } = renderHook(() => useCriarTransacao(), { wrapper: criarWrapper() });
    await act(async () => {
      await expect(result.current.mutateAsync({ tipo: 'despesa', valor: 10 } as never)).resolves.toEqual({ id: 'gravado' });
    });
    expect(api.criarTransacao).toHaveBeenCalledTimes(1);
  });
});

describe('offline de verdade (os dois sinais offline e a requisição falha por rede)', () => {
  it.each(casos)('%s rejeita na hora com "Sem internet" e não grava quando a rede volta', async (_nome, hook, args, servico) => {
    servico.mockRejectedValue(new TypeError('Failed to fetch'));
    const { result } = renderHook(() => hook(), { wrapper: criarWrapper() });
    const mutateAsync = result.current.mutateAsync as (a: unknown) => Promise<unknown>;
    let resultado: Awaited<ReturnType<typeof emAte50ms>> = PENDENTE;
    await act(async () => {
      resultado = await emAte50ms(mutateAsync(args));
    });
    expect(resultado).not.toBe(PENDENTE);
    expect(resultado).toMatchObject({ ok: false });
    const erro = (resultado as unknown as { erro: Error }).erro;
    expect(erro).toBeInstanceOf(ErroSemInternet);
    expect(erro.message).toBe(MENSAGEM_SEM_INTERNET);
    expect(servico).toHaveBeenCalledTimes(1);

    servico.mockResolvedValue({ id: 'gravado' });
    await voltarRede();
    expect(servico).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem(CHAVE_FILA_OFFLINE_LEGADA)).toBeNull();
  });

  it.each(errosDeRede)('%s vira "Sem internet"', async (_nome, criarErro) => {
    api.criarTransacao.mockRejectedValue(criarErro());
    const { result } = renderHook(() => useCriarTransacao(), { wrapper: criarWrapper() });
    await act(async () => {
      await expect(result.current.mutateAsync({ tipo: 'despesa', valor: 10 } as never)).rejects.toBeInstanceOf(ErroSemInternet);
    });
  });

  it('erro que não é de rede segue igual mesmo offline', async () => {
    const original = new AppError('Os dados informados não são válidos.', 'VALIDATION_ERROR', 400);
    api.criarTransacao.mockRejectedValue(original);
    const { result } = renderHook(() => useCriarTransacao(), { wrapper: criarWrapper() });
    await act(async () => {
      await expect(result.current.mutateAsync({ tipo: 'despesa', valor: 10 } as never)).rejects.toBe(original);
    });
  });

  it('o toast de erro da tela aparece (Novo lançamento) e nada é gravado depois', async () => {
    api.criarTransacao.mockRejectedValue(new TypeError('Failed to fetch'));
    function Tela() {
      const { abrirNovo, modais } = useLancamentoModais();
      return (
        <>
          <button onClick={abrirNovo}>Novo lançamento</button>
          {modais}
        </>
      );
    }
    const Wrapper = criarWrapper();
    render(
      <Wrapper>
        <ToastProvider>
          <Tela />
        </ToastProvider>
      </Wrapper>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Novo lançamento' }));
    const categoria = screen.getByPlaceholderText('Ex.: Alimentação, Transporte…');
    fireEvent.change(categoria, { target: { value: 'Mercado' } });
    fireEvent.change(screen.getByPlaceholderText('Descrição do lançamento'), { target: { value: 'Compra' } });
    fireEvent.change(screen.getByPlaceholderText('0,00'), { target: { value: '25' } });
    await act(async () => {
      fireEvent.submit(categoria.closest('form')!);
      await new Promise((r) => setTimeout(r, 50));
    });
    expect(screen.getByText('Erro ao criar lançamento')).toBeTruthy();
    expect(api.criarTransacao).toHaveBeenCalledTimes(1);

    api.criarTransacao.mockResolvedValue({ id: 'gravado' });
    await voltarRede();
    expect(api.criarTransacao).toHaveBeenCalledTimes(1);
  });
});

describe('online', () => {
  it.each(casos)('%s chama o serviço e propaga o erro dele (mesmo de rede)', async (_nome, hook, args, servico) => {
    navegadorOnline = true;
    onlineManager.setOnline(true);
    servico.mockRejectedValue(new TypeError('Failed to fetch'));
    const { result } = renderHook(() => hook(), { wrapper: criarWrapper() });
    const mutateAsync = result.current.mutateAsync as (a: unknown) => Promise<unknown>;
    await act(async () => {
      await expect(mutateAsync(args)).rejects.toThrow('Failed to fetch');
    });
    expect(servico).toHaveBeenCalledTimes(1);
  });
});

it('varredura: nenhum hook chama useMutation direto (todos passam por useMutacao, sem pausa offline)', () => {
  const dir = join(__dirname, '..');
  const diretos = readdirSync(dir)
    .filter((f) => /\.tsx?$/.test(f) && f !== 'useMutacao.ts')
    .filter((f) => /\buseMutation\s*[(<]/.test(readFileSync(join(dir, f), 'utf8')));
  expect(diretos).toEqual([]);
});

it('OfflineIndicator: só avisa "Sem internet", segue os eventos e apaga a fila legada do aparelho', () => {
  localStorage.setItem(CHAVE_FILA_OFFLINE_LEGADA, JSON.stringify([{ action: 'financas:criar', payload: {} }]));
  render(<OfflineIndicator />);
  expect(screen.getByRole('status').textContent).toMatch(/Sem internet/);
  expect(localStorage.getItem(CHAVE_FILA_OFFLINE_LEGADA)).toBeNull();
  act(() => {
    navegadorOnline = true;
    window.dispatchEvent(new Event('online'));
  });
  expect(screen.queryByRole('status')).toBeNull();
  act(() => {
    navegadorOnline = false;
    window.dispatchEvent(new Event('offline'));
  });
  expect(screen.getByRole('status')).toBeTruthy();
});

describe('limparFilaOfflineLegada com storage bloqueado', () => {
  it('getter de localStorage que lança (SecurityError) não escapa', () => {
    const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')!;
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      get: () => {
        throw new DOMException('negado', 'SecurityError');
      },
    });
    try {
      expect(() => limparFilaOfflineLegada()).not.toThrow();
    } finally {
      Object.defineProperty(globalThis, 'localStorage', original);
    }
  });

  it('removeItem que lança não escapa', () => {
    const removeItem = vi.fn(() => {
      throw new DOMException('negado', 'SecurityError');
    });
    expect(() => limparFilaOfflineLegada({ removeItem })).not.toThrow();
    expect(removeItem).toHaveBeenCalledWith(CHAVE_FILA_OFFLINE_LEGADA);
  });
});
