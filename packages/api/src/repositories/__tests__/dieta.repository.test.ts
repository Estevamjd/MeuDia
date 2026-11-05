import { beforeEach, expect, it, vi } from 'vitest';
import * as repo from '../dieta.repository';

/** Peso (Saúde e Treino, aba Peso): leitura por período e um registro por dia (UNIQUE user_id, data). */
const { getSupabase } = vi.hoisted(() => ({ getSupabase: vi.fn() }));
vi.mock('../supabase', () => ({ getSupabase }));

let result: { data: unknown; error: unknown };
const query = {
  select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), gte: vi.fn().mockReturnThis(),
  order: vi.fn().mockReturnThis(), limit: vi.fn().mockReturnThis(), upsert: vi.fn().mockReturnThis(),
  single: vi.fn().mockReturnThis(),
  then: (resolve: (value: unknown) => unknown) => Promise.resolve(result).then(resolve),
};
beforeEach(() => {
  vi.clearAllMocks();
  getSupabase.mockReturnValue({ from: vi.fn().mockReturnValue(query) });
});

it('peso desde a data: só da pessoa, em ordem de data, DECIMAL vira número', async () => {
  result = { data: [{ id: 'a', user_id: 'u', peso: '70.40', data: '2026-11-01', observacao: null }], error: null };
  const lidos = await repo.findRegistrosPesoDesde('u', '2026-08-05');
  expect(query.eq).toHaveBeenCalledWith('user_id', 'u');
  expect(query.gte).toHaveBeenCalledWith('data', '2026-08-05');
  expect(query.order).toHaveBeenCalledWith('data', { ascending: true });
  expect(lidos[0]!.peso).toBe(70.4);
});

it('registrar de novo no mesmo dia corrige (upsert em user_id,data), sem criar outra linha', async () => {
  result = { data: { id: 'a', user_id: 'u', peso: 71, data: '2026-11-02', observacao: null }, error: null };
  await repo.upsertRegistroPeso('u', { peso: 71, data: '2026-11-02' });
  expect(query.upsert).toHaveBeenCalledWith({ peso: 71, data: '2026-11-02', user_id: 'u' }, { onConflict: 'user_id,data' });
});

it('erro do banco propaga como DB_ERROR', async () => {
  result = { data: null, error: { code: '42501', message: 'rls' } };
  await expect(repo.findRegistrosPesoDesde('u', '2026-11-01')).rejects.toMatchObject({ code: 'DB_ERROR' });
});
