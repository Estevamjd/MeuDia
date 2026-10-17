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
  for (const m of ['select', 'eq', 'in', 'not', 'gte', 'order', 'single', 'insert', 'update', 'delete']) query[m] = vi.fn(() => query);
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
