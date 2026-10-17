import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as carteiras from '../carteiras.repository';
import * as transferencias from '../transferencias.repository';
import * as recebimentos from '../recebimentos-renda.repository';
import * as transacoes from '../transacao.repository';
import * as pagamentos from '../pagamentos-conta.repository';
import { TAMANHO_PAGINA } from '../cron-pagination';

const { getSupabase } = vi.hoisted(() => ({ getSupabase: vi.fn() }));
vi.mock('../supabase', () => ({ getSupabase }));

function mockClient(result: { data?: unknown; error?: unknown } = { data: [], error: null }) {
  const query: Record<string, unknown> = {};
  for (const m of ['range', 'select', 'eq', 'in', 'not', 'gte', 'order', 'or', 'limit', 'single', 'insert', 'update', 'delete']) query[m] = vi.fn(() => query);
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
  /**
   * Banco em memória com a semântica do PostgREST: filtro `or` de cursor (data,id), ordem (data,id) e corte em
   * `maxRows` por resposta. `aoPaginar` roda entre páginas (ex.: inserção com data retroativa).
   */
  function historicoPaginado(linhas: { id: string; data: string }[], maxRows = 1000, aoPaginar?: (pagina: number) => void) {
    const { query } = mockClient();
    let cursor: { data: string; id: string } | null = null;
    let pagina = 0;
    query.or = vi.fn((filtro: string) => {
      const m = /^data\.gt\.([^,]+),and\(data\.eq\.([^,]+),id\.gt\.([^)]+)\)$/.exec(filtro);
      if (!m || m[1] !== m[2]) throw new Error(`cursor inesperado: ${filtro}`);
      cursor = { data: m[1]!, id: m[3]! };
      return query;
    });
    query.limit = vi.fn((n: number) => {
      const ordenadas = [...linhas].sort((a, b) => a.data.localeCompare(b.data) || a.id.localeCompare(b.id));
      const c = cursor;
      const resto = c ? ordenadas.filter((l) => l.data > c.data || (l.data === c.data && l.id > c.id)) : ordenadas;
      cursor = null;
      aoPaginar?.(pagina++);
      return Promise.resolve({ data: resto.slice(0, Math.min(n, maxRows)), error: null });
    });
    return query;
  }
  const id = (i: number) => `id-${String(i).padStart(5, '0')}`;
  const buscas = [transacoes.findComCarteiraDesde, transferencias.findDesde];

  it.each(buscas)('pagina por chave (data,id) em lotes de TAMANHO_PAGINA até esgotar', async (buscar) => {
    const linhas = Array.from({ length: 1201 }, (_, i) => ({ id: id(i), data: i < 600 ? '2026-10-16' : '2026-10-17' }));
    const query = historicoPaginado(linhas);
    const resultado = await buscar('u', '2026-10-01');
    expect(resultado.map((l) => l.id)).toEqual(linhas.map((l) => l.id));
    expect(query.limit).toHaveBeenCalledWith(TAMANHO_PAGINA);
    expect(query.limit).toHaveBeenCalledTimes(4); // 500 + 500 + 201 + página vazia
    expect(query.or).toHaveBeenNthCalledWith(1, `data.gt.2026-10-16,and(data.eq.2026-10-16,id.gt.${id(499)})`);
    expect(query.order).toHaveBeenCalledWith('data', { ascending: true });
    expect(query.order).toHaveBeenCalledWith('id', { ascending: true });
    expect(query.range).not.toHaveBeenCalled();
  });
  it.each(buscas)('max-rows do projeto menor que a página não trunca o histórico', async (buscar) => {
    const linhas = Array.from({ length: 1000 }, (_, i) => ({ id: id(i), data: '2026-10-17' }));
    historicoPaginado(linhas, 300);
    expect(await buscar('u', '2026-10-01')).toHaveLength(1000);
  });
  it.each(buscas)('inserção retroativa entre páginas não duplica nem pula linhas existentes', async (buscar) => {
    const linhas = Array.from({ length: 700 }, (_, i) => ({ id: id(i), data: '2026-10-17' }));
    historicoPaginado(linhas, 1000, (pagina) => {
      if (pagina === 1) linhas.push({ id: 'id-retro', data: '2026-10-02' });
    });
    const ids = (await buscar('u', '2026-10-01')).map((l) => l.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toEqual(expect.arrayContaining(Array.from({ length: 700 }, (_, i) => id(i))));
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
