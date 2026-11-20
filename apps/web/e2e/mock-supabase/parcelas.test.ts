import { spawn, type ChildProcess } from 'node:child_process';
import path from 'node:path';
import crypto from 'node:crypto';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Protocolo do mock (server.mjs) para a 017 (parcelado no cartão), com o supabase-js de verdade:
 * - colunas parcela_grupo/parcela_num/parcela_total (NULL por padrão);
 * - CHECK transacoes_parcela_check e UNIQUE (user_id, parcela_grupo, parcela_num);
 * - insert em lote (array) atômico: uma linha inválida = nenhuma gravada;
 * - DELETE com eq(parcela_grupo) + gte(parcela_num) apaga só "esta e as próximas".
 */
const PORTA = 55000 + Math.floor(Math.random() * 500);
const URL_MOCK = `http://127.0.0.1:${PORTA}`;
let servidor: ChildProcess;
let db: SupabaseClient;
let uid: string;

beforeAll(async () => {
  servidor = spawn(process.execPath, [path.join(__dirname, 'server.mjs'), String(PORTA)], { stdio: 'ignore' });
  for (let i = 0; i < 100; i++) {
    if (await fetch(`${URL_MOCK}/__mock/health`).then((r) => r.ok, () => false)) break;
    await new Promise((r) => setTimeout(r, 50));
  }
  db = createClient(URL_MOCK, 'mock-anon-key', { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await db.auth.signUp({ email: 'parcelas.protocolo@example.test', password: 'senhaForte123' });
  expect(error).toBeNull();
  uid = data.user!.id;
});
afterAll(() => {
  servidor?.kill();
});

const COLS = 'id, descricao, valor, data, parcela_grupo, parcela_num, parcela_total';
const parcela = (grupo: string, num: number, total: number, extra: Record<string, unknown> = {}) => ({
  user_id: uid, tipo: 'despesa', categoria: 'Compras', descricao: 'Fone', valor: 10, data: `2026-${String(10 + num).padStart(2, '0')}-15`,
  parcela_grupo: grupo, parcela_num: num, parcela_total: total, ...extra,
});
const doGrupo = async (grupo: string) =>
  (await db.from('transacoes').select(COLS).eq('parcela_grupo', grupo).order('parcela_num')).data ?? [];

it('lançamento à vista nasce com as três colunas de parcela NULL', async () => {
  const { data, error } = await db.from('transacoes')
    .insert({ user_id: uid, tipo: 'despesa', categoria: 'Mercado', descricao: 'Pão', valor: 8 })
    .select(COLS).single();
  expect(error).toBeNull();
  expect(data).toMatchObject({ parcela_grupo: null, parcela_num: null, parcela_total: null });
});

it('insere as N parcelas num lote só e devolve todas', async () => {
  const grupo = crypto.randomUUID();
  const { data, error } = await db.from('transacoes').insert([1, 2, 3].map((n) => parcela(grupo, n, 3))).select(COLS);
  expect(error).toBeNull();
  expect(data).toHaveLength(3);
  expect((await doGrupo(grupo)).map((t) => t.parcela_num)).toEqual([1, 2, 3]);
});

it('lote com uma linha fora do CHECK não grava nenhuma (atômico)', async () => {
  const grupo = crypto.randomUUID();
  const { error } = await db.from('transacoes').insert([parcela(grupo, 1, 3), parcela(grupo, 2, 3), parcela(grupo, 4, 3)]);
  expect(error?.code).toBe('23514');
  expect(await doGrupo(grupo)).toEqual([]);
});

it('CHECK: receita parcelada, total 1 ou 25 e colunas pela metade são recusados', async () => {
  const grupo = crypto.randomUUID();
  for (const linha of [
    parcela(grupo, 1, 2, { tipo: 'receita' }),
    parcela(grupo, 1, 1),
    parcela(grupo, 1, 25),
    parcela(grupo, 1, 2, { parcela_total: null }),
    { user_id: uid, tipo: 'despesa', categoria: 'X', descricao: 'X', valor: 1, parcela_num: 1, parcela_total: 2 },
  ]) {
    const { error } = await db.from('transacoes').insert(linha);
    expect(error?.code).toBe('23514');
  }
  expect(await doGrupo(grupo)).toEqual([]);
});

it('UNIQUE (user_id, parcela_grupo, parcela_num): repetir a parcela no lote ou depois é 23505 e nada entra', async () => {
  const grupo = crypto.randomUUID();
  const noLote = await db.from('transacoes').insert([parcela(grupo, 1, 2), parcela(grupo, 1, 2)]);
  expect(noLote.error?.code).toBe('23505');
  expect(await doGrupo(grupo)).toEqual([]);

  expect((await db.from('transacoes').insert([parcela(grupo, 1, 2), parcela(grupo, 2, 2)])).error).toBeNull();
  const depois = await db.from('transacoes').insert(parcela(grupo, 2, 2));
  expect(depois.error?.code).toBe('23505');
  expect(await doGrupo(grupo)).toHaveLength(2);
});

it('DELETE eq(parcela_grupo) + gte(parcela_num) apaga só esta e as próximas, sem tocar outro grupo', async () => {
  const grupo = crypto.randomUUID();
  const outro = crypto.randomUUID();
  await db.from('transacoes').insert([1, 2, 3, 4].map((n) => parcela(grupo, n, 4)));
  await db.from('transacoes').insert([1, 2].map((n) => parcela(outro, n, 2)));
  const { data, error } = await db.from('transacoes').delete().eq('user_id', uid).eq('parcela_grupo', grupo).gte('parcela_num', 2).select('id');
  expect(error).toBeNull();
  expect(data).toHaveLength(3);
  expect((await doGrupo(grupo)).map((t) => t.parcela_num)).toEqual([1]);
  expect(await doGrupo(outro)).toHaveLength(2);
});

it('apagar uma parcela pelo id deixa as outras', async () => {
  const grupo = crypto.randomUUID();
  const { data } = await db.from('transacoes').insert([1, 2, 3].map((n) => parcela(grupo, n, 3))).select(COLS);
  const segunda = data!.find((t) => t.parcela_num === 2)!;
  expect((await db.from('transacoes').delete().eq('id', segunda.id)).error).toBeNull();
  expect((await doGrupo(grupo)).map((t) => t.parcela_num)).toEqual([1, 3]);
});
