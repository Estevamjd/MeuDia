import { spawn, type ChildProcess } from 'node:child_process';
import path from 'node:path';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Protocolo do mock (server.mjs) que o perfil de saúde usa, com o supabase-js de verdade:
 * - upsert ignoreDuplicates (Prefer: resolution=ignore-duplicates) = INSERT ... ON CONFLICT DO NOTHING;
 * - UPDATE condicional (eq em updated_at): 0 linhas = nada muda;
 * - /__mock/atraso segura só a rota pedida.
 */
const PORTA = 54400 + Math.floor(Math.random() * 500);
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
  const { data, error } = await db.auth.signUp({ email: 'perfil.protocolo@example.test', password: 'senhaForte123' });
  expect(error).toBeNull();
  uid = data.user!.id;
});
afterAll(() => {
  servidor?.kill();
});

const linha = (estado: string, extra: Record<string, unknown> = {}) => ({
  user_id: uid, estado, respostas: null, metas: null, prazo_meta: null, ritmo_pct: 0.375, formula_versao: 'v1', ...extra,
});
const COLS = 'user_id, estado, respostas, metas, prazo_meta, ritmo_pct, formula_versao, updated_at';

it('ignoreDuplicates insere quando não há linha e, havendo, não toca nela nem a devolve', async () => {
  const primeiro = await db.from('perfil_saude').upsert(linha('respondido', { metas: { kcal: 2345 } }), { onConflict: 'user_id', ignoreDuplicates: true }).select(COLS);
  expect(primeiro.error).toBeNull();
  expect(primeiro.data).toHaveLength(1);
  const antes = (await db.from('perfil_saude').select(COLS).eq('user_id', uid).maybeSingle()).data;

  const segundo = await db.from('perfil_saude').upsert(linha('adiado'), { onConflict: 'user_id', ignoreDuplicates: true }).select(COLS);
  expect(segundo.error).toBeNull();
  expect(segundo.data).toEqual([]);
  const depois = (await db.from('perfil_saude').select(COLS).eq('user_id', uid).maybeSingle()).data;
  expect(depois).toEqual(antes);
  expect(depois).toMatchObject({ estado: 'respondido', metas: { kcal: 2345 } });
});

it('UPDATE condicional por updated_at: base velha = 0 linhas e nada muda; base atual = muda só a coluna', async () => {
  const atual = (await db.from('perfil_saude').select(COLS).eq('user_id', uid).maybeSingle()).data!;
  const velho = await db.from('perfil_saude').update({ ritmo_pct: 0.25 }).eq('user_id', uid).eq('updated_at', '2000-01-01T00:00:00.000Z').select(COLS);
  expect(velho.error).toBeNull();
  expect(velho.data).toEqual([]);
  expect((await db.from('perfil_saude').select(COLS).eq('user_id', uid).maybeSingle()).data).toEqual(atual);

  const certo = await db.from('perfil_saude').update({ ritmo_pct: 0.25 }).eq('user_id', uid).eq('updated_at', atual.updated_at).select(COLS);
  expect(certo.data).toHaveLength(1);
  expect(certo.data![0]).toMatchObject({ ritmo_pct: 0.25, estado: 'respondido', metas: { kcal: 2345 } });
});

it('/__mock/atraso segura só a rota pedida', async () => {
  const r = await fetch(`${URL_MOCK}/__mock/atraso`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ rota: 'GET /rest/v1/perfil_saude', ms: 400 }),
  });
  expect(r.ok).toBe(true);
  let t = Date.now();
  await db.from('perfil_saude').select(COLS).eq('user_id', uid).maybeSingle();
  expect(Date.now() - t).toBeGreaterThanOrEqual(380);
  t = Date.now();
  await db.from('profiles').select('id').eq('id', uid).maybeSingle();
  expect(Date.now() - t).toBeLessThan(300);
});
