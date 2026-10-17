import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as carteiras from '../carteiras.repository';
import * as transferencias from '../transferencias.repository';
import * as recebimentos from '../recebimentos-renda.repository';
import * as transacoes from '../transacao.repository';
import * as pagamentos from '../pagamentos-conta.repository';

const { getSupabase } = vi.hoisted(() => ({ getSupabase: vi.fn() }));
vi.mock('../supabase', () => ({ getSupabase }));

function mockClient(result: { data?: unknown; error?: unknown } = { data: [], error: null }) {
  const query: Record<string, unknown> = {};
  for (const m of ['range', 'select', 'eq', 'in', 'not', 'gte', 'order', 'single', 'insert', 'update', 'delete']) query[m] = vi.fn(() => query);
  query.then = (resolve: (v: unknown) => unknown) => Promise.resolve({ data: null, error: null, ...result }).then(resolve);
  const client = { from: vi.fn(() => query), rpc: vi.fn().mockResolvedValue({ data: null, error: null, ...result }) };
  getSupabase.mockReturnValue(client);
  return { client, query: query as Record<string, ReturnType<typeof vi.fn>> };
}

beforeEach(() => vi.clearAllMocks());

describe('repositórios de carteiras, transferências e recebimentos (sem banco)', () => {
  const operations = [
    () => carteiras.findAll('user'), () => carteiras.findById('id', 'user'),
    () => carteiras.create('user', { nome: 'Nubank' }), () => carteiras.update('id', { arquivada: true }, 'user'),
    () => transferencias.findDesde('user', '2026-10-01'),
    () => transferencias.create('user', { origem_id: 'a', destino_id: 'b', valor: 1, data: '2026-10-17' }),
    () => transferencias.remove('id', 'user'),
    () => recebimentos.findByCompetencias('user', ['2026-10']),
    () => transacoes.findComCarteiraDesde('user', '2026-10-01'),
    () => pagamentos.findByCompetencias('user', ['2026-10']),
  ];
  it.each(operations.map((op, i) => [i, op] as const))('filtra/grava o usuário na operação %i', async (_, op) => {
    const { query } = mockClient();
    await op();
    const insert = query.insert!.mock.calls[0];
    if (insert) expect(insert[0]).toMatchObject({ user_id: 'user' });
    else expect(query.eq).toHaveBeenCalledWith('user_id', 'user');
  });
  it('saldo lê só lançamentos com carteira a partir da âncora', async () => {
    const { query } = mockClient();
    await transacoes.findComCarteiraDesde('u', '2026-09-20');
    expect(query.not).toHaveBeenCalledWith('carteira_id', 'is', null);
    expect(query.gte).toHaveBeenCalledWith('data', '2026-09-20');
  });
  it.each([transacoes.findComCarteiraDesde, transferencias.findDesde])('pagina histórico com movimento mais recente no final', async (buscar) => {
    const { query } = mockClient();
    const linhas = Array.from({ length: 1001 }, (_, i) => ({ id: String(i), data: '2026-10-17' }));
    query.range!.mockImplementation((inicio: number, fim: number) => Promise.resolve({ data: linhas.slice(inicio, fim + 1), error: null }));
    const resultado = await buscar('u', '2026-10-01');
    expect(resultado).toHaveLength(1001);
    expect(resultado.at(-1)?.id).toBe('1000');
    expect(query.range).toHaveBeenCalledTimes(2);
    expect(query.range).toHaveBeenLastCalledWith(1000, 1999);
    expect(query.order).toHaveBeenCalledWith('id', { ascending: true });
  });
  it.each(['42703', '42P01', 'PGRST204'])('schema antigo %s retorna erro amigável', async (code) => {
    mockClient({ error: { code, message: 'fixture' } });
    await expect(transacoes.findComCarteiraDesde('u', '2026-10-01')).rejects.toMatchObject({ code: 'SCHEMA_DESATUALIZADO', status: 503 });
  });
  it('listas vazias de competências não consultam o banco', async () => {
    const { client } = mockClient();
    expect(await recebimentos.findByCompetencias('u', [])).toEqual([]);
    expect(await pagamentos.findByCompetencias('u', [])).toEqual([]);
    expect(client.from).not.toHaveBeenCalled();
  });
  it('RPCs do Recebi mapeiam parâmetros', async () => {
    const { client } = mockClient({ data: { id: 'r' } });
    await recebimentos.rpcReceber('renda', '2026-10');
    expect(client.rpc).toHaveBeenCalledWith('receber_renda', { p_renda_id: 'renda', p_competencia: '2026-10', p_recebido_em: null, p_carteira_id: null });
    await recebimentos.rpcReceber('renda', '2026-10', '2026-10-17', 'cart');
    expect(client.rpc).toHaveBeenLastCalledWith('receber_renda', { p_renda_id: 'renda', p_competencia: '2026-10', p_recebido_em: '2026-10-17', p_carteira_id: 'cart' });
    await recebimentos.rpcDesfazer('renda', '2026-10');
    expect(client.rpc).toHaveBeenLastCalledWith('desfazer_recebimento', { p_renda_id: 'renda', p_competencia: '2026-10' });
  });
  it.each([['P0003', 'COMPETENCIA_JA_RECEBIDA', 409], ['23505', 'COMPETENCIA_JA_RECEBIDA', 409], ['P0002', 'NOT_FOUND', 404], ['22023', 'VALIDATION_ERROR', 400], ['XX000', 'DB_ERROR', 500]])(
    'RPC %s vira %s', async (dbCode, code, status) => {
      mockClient({ error: { code: dbCode, message: 'fixture' } });
      await expect(recebimentos.rpcReceber('r', '2026-10')).rejects.toMatchObject({ code, status });
      await expect(recebimentos.rpcDesfazer('r', '2026-10')).rejects.toMatchObject({ code, status });
    });
  it('erros de banco viram AppError; carteira inexistente vira NOT_FOUND', async () => {
    mockClient({ error: { message: 'Falha simulada' } });
    for (const op of operations) await expect(op()).rejects.toMatchObject({ code: 'DB_ERROR' });
    mockClient({ error: { code: 'PGRST116', message: 'fixture' } });
    await expect(carteiras.findById('x', 'u')).rejects.toMatchObject({ code: 'NOT_FOUND', status: 404 });
    mockClient({ error: { code: '23503', message: 'fixture' } });
    await expect(transferencias.create('u', { origem_id: 'a', destino_id: 'b', valor: 1, data: '2026-10-17' })).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});

it('RPC corrigir_saldo envia assinatura SQL e interpreta SETOF vazio/uma linha', async () => {
  const { client } = mockClient({ data: [{ id: 'ajuste' }] });
  expect(await carteiras.rpcCorrigirSaldo('c', -80, 'chave')).toEqual({ id: 'ajuste' });
  expect(client.rpc).toHaveBeenCalledWith('corrigir_saldo', { p_carteira_id: 'c', p_valor_real: -80, p_chave: 'chave' });
  mockClient();
  expect(await carteiras.rpcCorrigirSaldo('c', 80, 'chave')).toBeNull();
});
it('cadastro do onboarding reutiliza UUID e mantém âncora em retry com edição', async () => {
  const { query } = mockClient({ data: { id: 'estavel' } });
  query.upsert = vi.fn(() => query);
  await carteiras.createIdempotente('u', 'estavel', { nome: 'Nu editado', saldo_inicial: -100 });
  expect(query.upsert).toHaveBeenCalledWith({ id: 'estavel', user_id: 'u', nome: 'Nu editado', saldo_inicial: -100 }, { onConflict: 'id', ignoreDuplicates: true });
  expect(query.update).toHaveBeenCalledWith({ nome: 'Nu editado', saldo_inicial: -100 });
  expect(query.eq).toHaveBeenCalledWith('id', 'estavel');
  expect(query.eq).toHaveBeenCalledWith('user_id', 'u');
});
