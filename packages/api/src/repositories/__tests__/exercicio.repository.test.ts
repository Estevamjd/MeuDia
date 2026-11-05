import { beforeEach, expect, it, vi } from 'vitest';
import * as repo from '../exercicio.repository';

/**
 * C3 (PLANO-F1): o repositório pedia `tempo_descanso`, que não existe em `exercicios` (banco real: `descanso_segundos`,
 * `repeticoes INTEGER`; 000_baseline GAP-10). O PostgREST devolvia 400 ao listar ou gravar exercício.
 */
const { getSupabase } = vi.hoisted(() => ({ getSupabase: vi.fn() }));
vi.mock('../supabase', () => ({ getSupabase }));

// Colunas de `exercicios` em 000_baseline.sql (+ observacao, aditiva) e as da 008.
const COLUNAS_BASELINE = ['id', 'treino_id', 'nome', 'grupo_muscular', 'series', 'repeticoes', 'carga', 'descanso_segundos', 'ordem', 'created_at', 'observacao'];
const COLUNAS_008 = [...COLUNAS_BASELINE, 'repeticoes_min', 'repeticoes_max', 'modelo_origem'];

let results: { data: unknown; error: unknown }[];
const query = {
  select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), order: vi.fn().mockReturnThis(),
  insert: vi.fn().mockReturnThis(), update: vi.fn().mockReturnThis(), delete: vi.fn().mockReturnThis(),
  single: vi.fn().mockReturnThis(),
  then: (resolve: (value: unknown) => unknown) => Promise.resolve(results.shift() ?? { data: [], error: null }).then(resolve),
};
beforeEach(() => {
  vi.clearAllMocks();
  repo.__reiniciarDeteccao008();
  results = [];
  getSupabase.mockReturnValue({ from: vi.fn().mockReturnValue(query) });
});

const colunasPedidas = (): string[] => query.select.mock.calls.flatMap((args) => String(args[0]).split(',').map((c) => c.trim()));
const colunasGravadas = (): string[] => [...query.insert.mock.calls, ...query.update.mock.calls].flatMap((args) => Object.keys(args[0] as object));

const linha = {
  id: 'e1', treino_id: 't1', nome: 'Supino reto', series: 3, repeticoes: 8, repeticoes_min: 8, repeticoes_max: 12,
  carga: '57.5', descanso_segundos: 90, observacao: null, ordem: 0,
};

it('findByTreinoId só pede colunas que existem e devolve no formato do app', async () => {
  results = [{ data: [linha], error: null }];
  const [e] = await repo.findByTreinoId('t1');
  for (const c of colunasPedidas()) expect(COLUNAS_008).toContain(c);
  expect(colunasPedidas()).not.toContain('tempo_descanso');
  expect(e).toEqual({
    id: 'e1', treino_id: 't1', nome: 'Supino reto', series: 3, repeticoes: '8–12', repeticoes_min: 8, repeticoes_max: 12,
    carga: 57.5, tempo_descanso: 90, observacao: null, ordem: 0,
  });
});

it('create grava descanso_segundos e a faixa em min/max (nunca tempo_descanso nem texto em repeticoes)', async () => {
  results = [{ data: linha, error: null }];
  await repo.create({ treino_id: 't1', nome: 'Supino reto', series: 3, repeticoes: '8-12', tempo_descanso: 90 });
  expect(query.insert).toHaveBeenCalledWith({
    treino_id: 't1', nome: 'Supino reto', series: 3, descanso_segundos: 90, repeticoes: 8, repeticoes_min: 8, repeticoes_max: 12,
  });
  for (const c of [...colunasPedidas(), ...colunasGravadas()]) expect(COLUNAS_008).toContain(c);
});

it('série sem repetição (prancha): min, max e repeticoes NULL', async () => {
  results = [{ data: { ...linha, nome: 'Prancha', repeticoes: null, repeticoes_min: null, repeticoes_max: null }, error: null }];
  const e = await repo.update('e1', { repeticoes: '' });
  expect(query.update).toHaveBeenCalledWith({ repeticoes: null, repeticoes_min: null, repeticoes_max: null });
  expect(e).toMatchObject({ repeticoes: '', repeticoes_min: null, repeticoes_max: null });
});

it('faixa inválida não vai ao banco', async () => {
  await expect(repo.create({ treino_id: 't1', nome: 'X', repeticoes: '12-8' })).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  expect(query.insert).not.toHaveBeenCalled();
});

it('sem a 008 aplicada (42703): repete só com as colunas do baseline e segue assim', async () => {
  results = [
    { data: null, error: { code: '42703', message: 'column exercicios.repeticoes_min does not exist' } },
    { data: [{ ...linha, repeticoes: 10, repeticoes_min: undefined, repeticoes_max: undefined }], error: null },
    { data: [], error: null },
  ];
  const [e] = await repo.findByTreinoId('t1');
  expect(e).toMatchObject({ repeticoes: '10', repeticoes_min: 10, repeticoes_max: 10 });
  await repo.findByTreinoId('t1');
  const pedidas = query.select.mock.calls.map((args) => String(args[0]));
  expect(pedidas[1]).not.toContain('repeticoes_min');
  expect(pedidas[2]).not.toContain('repeticoes_min');
  for (const c of pedidas.slice(1).flatMap((s) => s.split(',').map((x) => x.trim()))) expect(COLUNAS_BASELINE).toContain(c);
});

it('sem a 008, gravar faixa usa só a coluna antiga (mínimo da faixa)', async () => {
  results = [
    { data: null, error: { code: 'PGRST204', message: "Could not find the 'repeticoes_min' column" } },
    { data: { ...linha, repeticoes: 8 }, error: null },
  ];
  await repo.create({ treino_id: 't1', nome: 'Supino reto', repeticoes: '8-12' });
  expect(query.insert).toHaveBeenLastCalledWith({ treino_id: 't1', nome: 'Supino reto', repeticoes: 8 });
});

it('erro que não é de schema vira DB_ERROR sem repetir', async () => {
  results = [{ data: null, error: { code: '23514', message: 'check' } }];
  await expect(repo.findByTreinoId('t1')).rejects.toMatchObject({ code: 'DB_ERROR' });
  expect(query.select).toHaveBeenCalledTimes(1);
});
