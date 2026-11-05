import { beforeEach, expect, it, vi } from 'vitest';
import * as repo from '../sessao.repository';

/**
 * C-1: a consulta pedia `data` e `concluido`, que não existem em `sessoes_treino` (banco real: `inicio`
 * timestamptz e `concluida`, ver 000_baseline GAP-10) — o PostgREST devolvia 400 em toda carga de página.
 */
const { getSupabase } = vi.hoisted(() => ({ getSupabase: vi.fn() }));
vi.mock('../supabase', () => ({ getSupabase }));

// Colunas de `sessoes_treino` em packages/database/migrations/000_baseline.sql (+ observacao, aditiva).
const COLUNAS_REAIS = ['id', 'user_id', 'treino_id', 'inicio', 'fim', 'duracao_minutos', 'concluida', 'observacao', 'created_at'];

let result: { data: unknown; error: unknown };
const query = {
  select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), gte: vi.fn().mockReturnThis(),
  lt: vi.fn().mockReturnThis(), lte: vi.fn().mockReturnThis(), order: vi.fn().mockReturnThis(),
  neq: vi.fn().mockReturnThis(), in: vi.fn().mockReturnThis(), limit: vi.fn().mockReturnThis(),
  insert: vi.fn().mockReturnThis(), update: vi.fn().mockReturnThis(), single: vi.fn().mockReturnThis(),
  then: (resolve: (value: unknown) => unknown) => Promise.resolve(result).then(resolve),
};
beforeEach(() => {
  vi.clearAllMocks();
  result = { data: [], error: null };
  getSupabase.mockReturnValue({ from: vi.fn().mockReturnValue(query) });
});

const colunasUsadas = (): string[] => [
  ...query.select.mock.calls.flatMap((args) => String(args[0]).split(',').map((c) => c.trim())),
  ...[query.eq, query.gte, query.lt, query.lte, query.order].flatMap((f) => f.mock.calls.map((args) => String(args[0]))),
];

it('findByUserAndDateRange só usa colunas que existem e filtra o intervalo por `inicio`', async () => {
  await repo.findByUserAndDateRange('u', '2026-11-02', '2026-11-08');
  for (const c of colunasUsadas()) expect(COLUNAS_REAIS).toContain(c);
  expect(query.gte).toHaveBeenCalledWith('inicio', new Date(2026, 10, 2).toISOString());
  // fim inclusivo: até o começo do dia seguinte (exclusivo)
  expect(query.lt).toHaveBeenCalledWith('inicio', new Date(2026, 10, 9).toISOString());
});

it('devolve no formato do app: `data` (dia local de `inicio`) e `concluido`', async () => {
  const inicio = new Date(2026, 10, 2, 7, 30).toISOString();
  result = {
    data: [{ id: 's', user_id: 'u', treino_id: 't', inicio, duracao_minutos: 40, concluida: true, observacao: null, created_at: inicio }],
    error: null,
  };
  const [s] = await repo.findByUserAndDateRange('u', '2026-11-02', '2026-11-02');
  expect(s).toMatchObject({ id: 's', data: '2026-11-02', concluido: true });
  expect(s).not.toHaveProperty('concluida');
});

it('create/update gravam `concluida`, nunca `data`/`concluido`', async () => {
  const row = { id: 's', user_id: 'u', treino_id: 't', inicio: new Date().toISOString(), duracao_minutos: null, concluida: false, observacao: null, created_at: '' };
  result = { data: row, error: null };
  await repo.create('u', { treino_id: 't', data: '2026-11-02', concluido: false });
  expect(query.insert).toHaveBeenCalledWith({ treino_id: 't', concluida: false, user_id: 'u' });
  await repo.update('s', { concluido: true, duracao_minutos: 30 });
  expect(query.update).toHaveBeenCalledWith({ concluida: true, duracao_minutos: 30 });
  for (const c of colunasUsadas()) expect(COLUNAS_REAIS).toContain(c);
});

it('propaga erro do banco como DB_ERROR', async () => {
  result = { data: null, error: { message: 'boom' } };
  await expect(repo.findByUserAndDateRange('u', '2026-11-02', '2026-11-02')).rejects.toMatchObject({ code: 'DB_ERROR' });
});

// C4 (PLANO-F1): `series_realizadas` no banco real (000_baseline GAP-10) tem serie_numero/carga/repeticoes/concluida;
// o código pedia numero_serie/carga_usada/reps_feitas/concluido e o PostgREST devolvia 400.
const COLUNAS_SERIE_REAIS = ['id', 'sessao_id', 'exercicio_id', 'serie_numero', 'repeticoes', 'carga', 'concluida', 'created_at', 'observacao'];
const colunasSerie = (): string[] => [
  ...colunasUsadas(),
  ...[query.insert, query.update].flatMap((f) => f.mock.calls.flatMap((args) => {
    const v = args[0] as object | object[];
    return (Array.isArray(v) ? v : [v]).flatMap((o) => Object.keys(o));
  })),
];
const serieRow = { id: 'r1', sessao_id: 's', exercicio_id: 'e', serie_numero: 2, carga: '57.5', repeticoes: 8, concluida: true };

it('séries: lê só colunas reais e devolve numero_serie/carga_usada/reps_feitas/concluido', async () => {
  result = { data: [serieRow], error: null };
  const [s] = await repo.findSeriesBySessao('s');
  expect(s).toEqual({ id: 'r1', sessao_id: 's', exercicio_id: 'e', numero_serie: 2, carga_usada: 57.5, reps_feitas: 8, concluido: true });
  for (const c of colunasSerie()) expect(COLUNAS_SERIE_REAIS).toContain(c);
  expect(query.order).toHaveBeenCalledWith('serie_numero', { ascending: true });
});

it('séries: create/update gravam serie_numero/carga/repeticoes/concluida', async () => {
  result = { data: [serieRow], error: null };
  await repo.createSeriesRealizadas([{ sessao_id: 's', exercicio_id: 'e', numero_serie: 1, carga_usada: 60, reps_feitas: 10, concluido: true }]);
  expect(query.insert).toHaveBeenCalledWith([{ sessao_id: 's', exercicio_id: 'e', serie_numero: 1, carga: 60, repeticoes: 10, concluida: true }]);
  result = { data: serieRow, error: null };
  await repo.updateSerie('r1', { carga_usada: null, concluido: false });
  expect(query.update).toHaveBeenCalledWith({ carga: null, concluida: false });
  for (const c of colunasSerie()) expect(COLUNAS_SERIE_REAIS).toContain(c);
});

it('histórico por exercício ordena pela data da série (não pelo UUID da sessão)', async () => {
  result = { data: [serieRow], error: null };
  await repo.findSeriesByExercicioId('e', 5);
  expect(query.order).toHaveBeenCalledWith('created_at', { ascending: false });
  for (const c of colunasSerie()) expect(COLUNAS_SERIE_REAIS).toContain(c);
});

it('séries recentes: sessões da pessoa sem a atual, depois as séries delas', async () => {
  result = { data: [{ id: 's9', inicio: '2026-11-02T10:00:00Z' }], error: null };
  const r = await repo.findSeriesRecentes('u', ['e'], { excluirSessaoId: 'atual' });
  expect(query.eq).toHaveBeenCalledWith('user_id', 'u');
  expect(query.neq).toHaveBeenCalledWith('id', 'atual');
  expect(query.order).toHaveBeenCalledWith('inicio', { ascending: false });
  expect(query.in).toHaveBeenCalledWith('sessao_id', ['s9']);
  expect(query.in).toHaveBeenCalledWith('exercicio_id', ['e']);
  expect(r.sessoes).toEqual([{ id: 's9', inicio: '2026-11-02T10:00:00Z' }]);
});

it('séries recentes sem exercício não consulta o banco', async () => {
  expect(await repo.findSeriesRecentes('u', [])).toEqual({ sessoes: [], series: [] });
  expect(getSupabase).not.toHaveBeenCalled();
});
