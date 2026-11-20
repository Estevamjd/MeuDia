import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { passouDoLimite } from '../limite';

function cliente(resposta: unknown, count: number | null = 0, erroContagem: unknown = null) {
  const q = { select: vi.fn(), eq: vi.fn(), gte: vi.fn(), then: undefined as unknown };
  q.select.mockReturnValue(q); q.eq.mockReturnValue(q); q.gte.mockReturnValue(q);
  q.then = (resolve: (value: unknown) => unknown) => Promise.resolve({ count, error: erroContagem }).then(resolve);
  const rpc = vi.fn().mockResolvedValue(resposta);
  const from = vi.fn().mockReturnValue(q);
  return { client: { rpc, from } as unknown as SupabaseClient, rpc, from, q };
}
afterEach(() => vi.unstubAllEnvs());

describe('cota diária protegida', () => {
  it.each([true, false])('usa decisão atômica permitido=%s sem contar chat apagável', async (permitido) => {
    const c = cliente({ data: { permitido, usado: 50, limite: 50 }, error: null });
    expect(await passouDoLimite(c.client, 'a')).toBe(!permitido);
    expect(c.rpc).toHaveBeenCalledWith('ia_consumir_cota', { p_limite: 50 });
    expect(c.from).not.toHaveBeenCalled();
  });
  it.each(['PGRST202', '42883'])('RPC ausente %s usa contagem legada BRT', async (code) => {
    const c = cliente({ data: null, error: { code } }, 50);
    expect(await passouDoLimite(c.client, 'a', new Date('2026-11-21T01:30:00Z'))).toBe(false);
    expect(c.q.eq).toHaveBeenCalledWith('user_id', 'a');
    expect(c.q.eq).toHaveBeenCalledWith('role', 'user');
    expect(c.q.gte).toHaveBeenCalledWith('created_at', '2026-11-20T03:00:00.000Z');
  });
  it('HTTP 404 de RPC ausente também permite deploy antes da migration', async () => {
    const c = cliente({ data: null, error: { code: '' }, status: 404 }, 51);
    expect(await passouDoLimite(c.client, 'a')).toBe(true);
    expect(c.from).toHaveBeenCalledWith('chat_agente');
  });
  it('respeita limite configurado', async () => {
    vi.stubEnv('IA_LIMITE_DIARIO', '3');
    const c = cliente({ data: { permitido: true }, error: null });
    expect(await passouDoLimite(c.client, 'a')).toBe(false);
    expect(c.rpc).toHaveBeenCalledWith('ia_consumir_cota', { p_limite: 3 });
  });
  it.each([
    { data: null, error: { code: '42501' }, status: 403 },
    { data: null, error: { code: 'PGRST000' }, status: 500 },
    { data: null, error: null },
    { data: { permitido: 'true' }, error: null },
  ])('erro real ou resposta inválida falha fechado sem fallback legado', async (resposta) => {
    const c = cliente(resposta);
    expect(await passouDoLimite(c.client, 'a')).toBe(true);
    expect(c.from).not.toHaveBeenCalled();
  });
  it('falha de transporte falha fechado', async () => {
    const c = cliente(null);
    c.rpc.mockRejectedValue(new Error('rede'));
    expect(await passouDoLimite(c.client, 'a')).toBe(true);
    expect(c.from).not.toHaveBeenCalled();
  });
  it.each([[null, null], [null, { code: 'x' }]] as const)('contagem legada sem resultado falha fechado', async (count, error) => {
    const c = cliente({ data: null, error: { code: 'PGRST202' } }, count, error);
    expect(await passouDoLimite(c.client, 'a')).toBe(true);
  });
});
