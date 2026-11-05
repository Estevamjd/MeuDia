import { beforeEach, expect, it, vi } from 'vitest';
import * as repo from '../preferencias-agente.repository';

/** Lembrete de treino (`notif_treino`, 008): desligado por padrão; sem a 008, null (a tela mostra indisponível). */
const { getSupabase } = vi.hoisted(() => ({ getSupabase: vi.fn() }));
vi.mock('../supabase', () => ({ getSupabase }));

let result: { data: unknown; error: unknown };
const query = {
  select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), maybeSingle: vi.fn().mockReturnThis(),
  upsert: vi.fn().mockReturnThis(), single: vi.fn().mockReturnThis(),
  then: (resolve: (value: unknown) => unknown) => Promise.resolve(result).then(resolve),
};
beforeEach(() => {
  vi.clearAllMocks();
  getSupabase.mockReturnValue({ from: vi.fn().mockReturnValue(query) });
});

it('sem linha de preferências = desligado', async () => {
  result = { data: null, error: null };
  expect(await repo.findLembreteTreino('u')).toBe(false);
});

it('lê o valor gravado', async () => {
  result = { data: { notif_treino: true }, error: null };
  expect(await repo.findLembreteTreino('u')).toBe(true);
});

it('coluna ainda não existe (008 não aplicada): null, sem erro', async () => {
  result = { data: null, error: { code: '42703', message: 'column preferencias_agente.notif_treino does not exist' } };
  expect(await repo.findLembreteTreino('u')).toBeNull();
});

it('outro erro do banco propaga', async () => {
  result = { data: null, error: { code: '42501', message: 'rls' } };
  await expect(repo.findLembreteTreino('u')).rejects.toMatchObject({ code: 'DB_ERROR' });
});

it('salvar grava só notif_treino da própria pessoa', async () => {
  result = { data: { notif_treino: true }, error: null };
  expect(await repo.salvarLembreteTreino('u', true)).toBe(true);
  expect(query.upsert).toHaveBeenCalledWith({ user_id: 'u', notif_treino: true }, { onConflict: 'user_id' });
});

it('salvar sem a 008 vira SCHEMA_DESATUALIZADO', async () => {
  result = { data: null, error: { code: 'PGRST204', message: "Could not find the 'notif_treino' column" } };
  await expect(repo.salvarLembreteTreino('u', true)).rejects.toMatchObject({ code: 'SCHEMA_DESATUALIZADO' });
});
