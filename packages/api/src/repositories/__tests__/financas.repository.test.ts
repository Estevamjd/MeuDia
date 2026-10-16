import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import * as contas from '../contas-pagar.repository';
import * as transacoes from '../transacao.repository';
import * as pagamentos from '../pagamentos-conta.repository';
import * as rendas from '../rendas.repository';
import * as orcamento from '../orcamento.repository';
import * as push from '../push-subscriptions.repository';
import { reservarLembreteParaCron } from '../lembretes-enviados.repository';

const { getSupabase } = vi.hoisted(() => ({ getSupabase: vi.fn() }));
vi.mock('../supabase', () => ({ getSupabase }));

function mockClient(data: unknown = []) {
  const query = {
    select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), in: vi.fn().mockReturnThis(),
    range: vi.fn().mockReturnThis(), order: vi.fn().mockReturnThis(), single: vi.fn().mockReturnThis(), maybeSingle: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(), update: vi.fn().mockReturnThis(), delete: vi.fn().mockReturnThis(),
    upsert: vi.fn().mockReturnThis(), then: (resolve: (value: unknown) => unknown) => Promise.resolve({ data, error: null }).then(resolve),
  };
  const client = { from: vi.fn((_table: string) => query), rpc: vi.fn().mockResolvedValue({ data, error: null }) };
  return { client, query, admin: client as unknown as SupabaseClient };
}

beforeEach(() => vi.clearAllMocks());
describe('BE-03: repositories (sem banco)', () => {
  const input = { descricao: 'Conta', valor: 10, recorrencia: 'mensal' as const, dia_vencimento: 2 };
  const sub = { endpoint: 'https://example.invalid', keys: { p256dh: 'fixture', auth: 'fixture' } };
  const operations = [
    () => contas.findAll('user', { ativo: false }), () => contas.findById('id', 'user'),
    () => contas.findByAssinatura('assinatura', 'user'), () => contas.create('user', input),
    () => contas.update('id', { ativo: false }, 'user'),
    () => transacoes.findByIds('user', ['historica']),
    () => pagamentos.findByCompetencia('user', '2026-10'), () => pagamentos.findByConta('user', 'id'),
    () => rendas.findAll('user'), () => rendas.findById('id', 'user'),
    () => rendas.create('user', { descricao: 'Renda', valor: 10 }), () => rendas.update('id', { valor: 20 }, 'user'), () => rendas.remove('id', 'user'),
    () => orcamento.findAll('user'), () => orcamento.findById('id', 'user'),
    () => orcamento.create('user', { categoria: 'Contas', valor_planejado: 1 }),
    () => orcamento.update('id', { valor_planejado: 2 }, 'user'), () => orcamento.remove('id', 'user'),
    () => orcamento.upsert('user', { categoria: 'Contas', valor_planejado: 1 }),
    () => push.upsertByEndpoint('user', sub), () => push.removeByEndpoint('user', sub.endpoint),
  ];
  it.each(operations.map((operation, i) => [i, operation] as const))('filtra usuário na operação %i', async (_, operation) => {
    const { client, query } = mockClient();
    getSupabase.mockReturnValue(client);
    await operation();
    if (query.insert.mock.calls.length || query.upsert.mock.calls.length) {
      const escrita = query.insert.mock.calls[0] ?? query.upsert.mock.calls[0];
      expect(escrita?.[0]).toMatchObject({ user_id: 'user' });
      expect(query.eq).not.toHaveBeenCalled();
    } else expect(query.eq).toHaveBeenCalledWith('user_id', 'user');
  });
  it('ordena histórico pela competência mais recente', async () => {
    const { client, query } = mockClient(); getSupabase.mockReturnValue(client);
    await pagamentos.findByConta('user', 'conta');
    expect(query.order).toHaveBeenCalledWith('competencia', { ascending: false });
  });
  it('mapeia as RPCs para os parâmetros do schema', async () => {
    const { client } = mockClient(); getSupabase.mockReturnValue(client);
    await contas.rpcPagar('conta', '2026-10');
    expect(client.rpc).toHaveBeenCalledWith('pagar_conta', { p_conta_id: 'conta', p_competencia: '2026-10', p_pago_em: null, p_banco: null });
    await contas.rpcDesfazer('conta', '2026-10');
    expect(client.rpc).toHaveBeenCalledWith('desfazer_pagamento', { p_conta_id: 'conta', p_competencia: '2026-10' });
  });
  it.each([[[], false], [[{ id: 'reserva' }], true]] as const)('reserva duplicada ou nova', async (data, esperado) => {
    const { admin, query } = mockClient(data);
    const row = { user_id: 'user', conta_id: 'conta', competencia: '2026-10', etapa: 'D0' as const };
    expect(await reservarLembreteParaCron(admin, row)).toBe(esperado);
    expect(query.upsert).toHaveBeenCalledWith({ ...row, canal: 'push' }, { onConflict: 'conta_id,competencia,etapa,canal', ignoreDuplicates: true });
  });
  it('carrega apenas contas ativas de usuários inscritos, sem consultar assinaturas', async () => {
    const { admin, client, query } = mockClient([{ user_id: 'user' }]);
    await contas.contasAtivasComInscricaoParaCron(admin);
    expect(client.from.mock.calls.map(call => call[0])).toEqual(['push_subscriptions', 'contas_pagar']);
    expect(query.eq).toHaveBeenCalledWith('ativo', true);
    expect(query.in).toHaveBeenCalledWith('user_id', ['user']);
  });
  it('helpers administrativos usam somente o client recebido', async () => {
    const { admin, query, client } = mockClient();
    await pagamentos.pagamentosDasCompetenciasParaCron(admin, ['2026-10', '2026-11'], ['user']);
    expect(query.in).toHaveBeenCalledWith('competencia', ['2026-10', '2026-11']);
    await push.inscricoesDoUsuarioParaCron(admin, 'user');
    expect(query.eq).toHaveBeenCalledWith('user_id', 'user');
    await push.removerInscricaoParaCron(admin, 'inscricao');
    expect(query.eq).toHaveBeenCalledWith('id', 'inscricao');
    expect(query.delete).toHaveBeenCalledTimes(1);
    expect(client.from).toHaveBeenCalledWith('push_subscriptions');
    expect(getSupabase).not.toHaveBeenCalled();
  });
  it('não consulta contas sem inscrições nem pagamentos sem competências', async () => {
    const { admin, client } = mockClient();
    expect(await contas.contasAtivasComInscricaoParaCron(admin)).toEqual([]);
    expect(await pagamentos.pagamentosDasCompetenciasParaCron(admin, [], [])).toEqual([]);
    expect(client.from).toHaveBeenCalledTimes(1);
  });
  it('converte falhas de banco em AppError', async () => {
    const { client, query, admin } = mockClient();
    query.then = resolve => Promise.resolve({ data: null, error: { message: 'Falha simulada' } }).then(resolve);
    getSupabase.mockReturnValue(client);
    for (const operation of operations) await expect(operation()).rejects.toMatchObject({ code: 'DB_ERROR' });
    await expect(reservarLembreteParaCron(admin, { user_id: 'user', conta_id: 'conta', competencia: '2026-10', etapa: 'D0' })).rejects.toMatchObject({ code: 'DB_ERROR' });
  });
});

describe('review: erros e paginação', () => {
  it.each(['P0003', '23505'])('pagar mapeia %s para conflito de competência', async code => {
    const { client } = mockClient(); getSupabase.mockReturnValue(client);
    client.rpc.mockResolvedValue({ data: null, error: { code, message: 'fixture' } } as never);
    await expect(contas.rpcPagar('c', '2026-10')).rejects.toMatchObject({ code: 'COMPETENCIA_JA_PAGA', status: 409 });
  });
  it.each([['P0002', 'NOT_FOUND', 404], ['22023', 'VALIDATION_ERROR', 400]])('RPC %s', async (dbCode, code, status) => {
    const { client } = mockClient(); getSupabase.mockReturnValue(client);
    client.rpc.mockResolvedValue({ data: null, error: { code: dbCode, message: 'fixture' } } as never);
    await expect(contas.rpcPagar('c', '2026-10')).rejects.toMatchObject({ code, status });
  });
  it('PGRST116 vira NOT_FOUND e 23505 da inscrição vira CONFLICT', async () => {
    const { client, query } = mockClient(); getSupabase.mockReturnValue(client);
    query.then = resolve => Promise.resolve({ data: null, error: { code: 'PGRST116', message: 'fixture' } }).then(resolve);
    for (const op of [() => contas.findById('c', 'u'), () => rendas.findById('r', 'u'), () => orcamento.findById('o', 'u')]) await expect(op()).rejects.toMatchObject({ code: 'NOT_FOUND', status: 404 });
    query.then = resolve => Promise.resolve({ data: null, error: { code: '23505', message: 'fixture' } }).then(resolve);
    await expect(push.upsertByEndpoint('u', { endpoint: 'https://example.invalid', keys: { p256dh: 'fixture', auth: 'fixture' } })).rejects.toMatchObject({ code: 'CONFLICT', status: 409 });
    expect(query.upsert).toHaveBeenCalledWith(expect.objectContaining({ user_id: 'u' }), { onConflict: 'user_id,endpoint' });
  });
  it('pagamentos do cron restringem usuários e ignoram lista vazia', async () => {
    const { admin, client, query } = mockClient();
    await pagamentos.pagamentosDasCompetenciasParaCron(admin, ['2026-10'], ['u']);
    expect(query.in).toHaveBeenCalledWith('user_id', ['u']);
    expect(query.range).toHaveBeenCalledWith(0, 499);
    client.from.mockClear();
    expect(await pagamentos.pagamentosDasCompetenciasParaCron(admin, ['2026-10'], [])).toEqual([]);
    expect(client.from).not.toHaveBeenCalled();
  });
  it('cron lê além da primeira página em inscrições, contas e pagamentos', async () => {
    const { admin, client, query } = mockClient();
    let page = 0;
    query.range.mockImplementation((start: number) => {
      page = start;
      return query;
    });
    query.then = resolve => Promise.resolve({ data: page === 0 ? Array.from({ length: 500 }, (_, i) => ({ id: String(i), user_id: 'u' })) : [{ id: 'ultimo', user_id: 'u' }], error: null }).then(resolve);
    expect((await contas.contasAtivasComInscricaoParaCron(admin)).length).toBe(501);
    expect(query.range.mock.calls).toEqual([[0, 499], [500, 999], [0, 499], [500, 999]]);
    query.range.mockClear();
    expect((await pagamentos.pagamentosDasCompetenciasParaCron(admin, ['2026-10'], ['u'])).length).toBe(501);
    expect(query.range.mock.calls).toEqual([[0, 499], [500, 999]]);
    expect((await push.inscricoesDoUsuarioParaCron(admin, 'u')).length).toBe(501);
    expect(client.from).not.toHaveBeenCalledWith('assinaturas');
  });
});

it('consulta de transações históricas ignora ids vazios e limita lotes', async () => {
  const { client, query } = mockClient(); getSupabase.mockReturnValue(client);
  expect(await transacoes.findByIds('u', [])).toEqual([]);
  expect(client.from).not.toHaveBeenCalled();
  const ids = Array.from({ length: 101 }, (_, i) => String(i));
  await transacoes.findByIds('u', ids);
  expect(query.in).toHaveBeenCalledWith('id', ids.slice(0, 100));
  expect(query.in).toHaveBeenCalledWith('id', ['100']);
  expect(query.eq).toHaveBeenCalledWith('user_id', 'u');
});
