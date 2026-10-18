import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as metas from '../metas.repository';

const { getSupabase } = vi.hoisted(() => ({ getSupabase: vi.fn() }));
vi.mock('../supabase', () => ({ getSupabase }));

function mockClient(result: { data?: unknown; error?: unknown } = { data: [], error: null }) {
  const query: Record<string, unknown> = {};
  for (const m of ['select', 'eq', 'order', 'single', 'insert', 'update', 'delete']) query[m] = vi.fn(() => query);
  query.then = (resolve: (v: unknown) => unknown) => Promise.resolve({ data: null, error: null, ...result }).then(resolve);
  const client = { from: vi.fn(() => query), rpc: vi.fn().mockResolvedValue({ data: null, error: null, ...result }) };
  getSupabase.mockReturnValue(client);
  return { client, query: query as Record<string, ReturnType<typeof vi.fn>> };
}

beforeEach(() => vi.clearAllMocks());

describe('metas.repository', () => {
  it.each([
    () => metas.findAll('user'), () => metas.update('id', { valor_guardado: 1 }, 'user'), () => metas.remove('id', 'user'),
  ].map((op, i) => [i, op] as const))('filtra o usuário na operação %i', async (_, op) => {
    const { query } = mockClient();
    await op();
    expect(query.eq).toHaveBeenCalledWith('user_id', 'user');
  });
  it('cria com o user_id', async () => {
    const { query } = mockClient({ data: { id: 'm' } });
    await metas.create('user', { nome: 'Videogame', valor_alvo: 3000 });
    expect(query.insert).toHaveBeenCalledWith({ nome: 'Videogame', valor_alvo: 3000, user_id: 'user' });
  });
  it('Guardei usa a RPC atômica; P0002 → 404, 22023 → 400', async () => {
    const { client } = mockClient({ data: { id: 'm', valor_guardado: 500 } });
    await expect(metas.rpcGuardar('m', 500)).resolves.toMatchObject({ valor_guardado: 500 });
    expect(client.rpc).toHaveBeenCalledWith('guardar_na_meta', { p_meta_id: 'm', p_valor: 500 });
    mockClient({ error: { code: 'P0002', message: 'Meta não encontrada' } });
    await expect(metas.rpcGuardar('m', 1)).rejects.toMatchObject({ status: 404 });
    mockClient({ error: { code: '22023', message: 'Valor inválido' } });
    await expect(metas.rpcGuardar('m', 1)).rejects.toMatchObject({ status: 400 });
  });
  it('sem a 007 (tabela ausente) vira SCHEMA_DESATUALIZADO', async () => {
    mockClient({ error: { code: '42P01', message: 'relation "public.metas" does not exist' } });
    await expect(metas.findAll('user')).rejects.toMatchObject({ code: 'SCHEMA_DESATUALIZADO' });
  });
});
