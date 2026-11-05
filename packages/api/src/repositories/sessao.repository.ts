import type {
  SessaoTreino,
  SessaoTreinoInsert,
  SerieRealizada,
  SerieRealizadaInsert,
} from '@meudia/shared';
import { AppError } from '@meudia/shared';
import { addDays, format, parseISO } from 'date-fns';
import { getSupabase } from './supabase';

// Banco real (000_baseline, GAP-10): `inicio` (timestamptz) e `concluida`; não há `data` nem `concluido`.
// Pedir essas colunas dava 400 do PostgREST. O app segue vendo `data`/`concluido` via `paraSessao`.
const COLUNAS_SESSAO = 'id, user_id, treino_id, inicio, duracao_minutos, concluida, observacao, created_at';

interface SessaoRow {
  id: string;
  user_id: string;
  treino_id: string | null;
  inicio: string;
  duracao_minutos: number | null;
  concluida: boolean | null;
  observacao: string | null;
  created_at: string;
}

function paraSessao({ inicio, concluida, ...resto }: SessaoRow): SessaoTreino {
  return { ...resto, data: format(new Date(inicio), 'yyyy-MM-dd'), concluido: !!concluida };
}

// `data` (só o dia) não vai ao banco: `inicio` fica com o default NOW(), que guarda também a hora.
function paraRow(sessao: Partial<SessaoTreinoInsert>): Record<string, unknown> {
  const { concluido, ...resto } = sessao;
  delete resto.data;
  return concluido === undefined ? resto : { ...resto, concluida: concluido };
}

/** `startDate`/`endDate` em AAAA-MM-DD (dia local, inclusive): vira [início de startDate, início do dia após endDate). */
export async function findByUserAndDateRange(
  userId: string,
  startDate: string,
  endDate: string,
): Promise<SessaoTreino[]> {
  const { data, error } = await getSupabase()
    .from('sessoes_treino')
    .select(COLUNAS_SESSAO)
    .eq('user_id', userId)
    .gte('inicio', parseISO(startDate).toISOString())
    .lt('inicio', addDays(parseISO(endDate), 1).toISOString())
    .order('inicio', { ascending: true });

  if (error) throw new AppError(error.message, 'DB_ERROR');
  return (data as SessaoRow[]).map(paraSessao);
}

export async function findById(sessaoId: string): Promise<SessaoTreino> {
  const { data, error } = await getSupabase()
    .from('sessoes_treino')
    .select(COLUNAS_SESSAO)
    .eq('id', sessaoId)
    .single();

  if (error) throw new AppError(error.message, 'DB_ERROR');
  return paraSessao(data as SessaoRow);
}

export async function create(userId: string, data: SessaoTreinoInsert): Promise<SessaoTreino> {
  const { data: created, error } = await getSupabase()
    .from('sessoes_treino')
    .insert({ ...paraRow(data), user_id: userId })
    .select(COLUNAS_SESSAO)
    .single();

  if (error) throw new AppError(error.message, 'DB_ERROR');
  return paraSessao(created as SessaoRow);
}

export async function update(sessaoId: string, data: Partial<SessaoTreinoInsert>): Promise<SessaoTreino> {
  const { data: updated, error } = await getSupabase()
    .from('sessoes_treino')
    .update(paraRow(data))
    .eq('id', sessaoId)
    .select(COLUNAS_SESSAO)
    .single();

  if (error) throw new AppError(error.message, 'DB_ERROR');
  return paraSessao(updated as SessaoRow);
}

// C4 (PLANO-F1): banco real tem `serie_numero`, `carga`, `repeticoes` e `concluida` em `series_realizadas`;
// o app usa `numero_serie`, `carga_usada`, `reps_feitas` e `concluido`. Pedir os nomes do app dava 400.
const COLUNAS_SERIE = 'id, sessao_id, exercicio_id, serie_numero, carga, repeticoes, concluida';

export interface SerieRow {
  id: string;
  sessao_id: string;
  exercicio_id: string;
  serie_numero: number;
  carga: number | string | null;
  repeticoes: number | null;
  concluida: boolean | null;
}

export function paraSerie(row: SerieRow): SerieRealizada {
  return {
    id: row.id,
    sessao_id: row.sessao_id,
    exercicio_id: row.exercicio_id,
    numero_serie: row.serie_numero,
    carga_usada: row.carga === null || row.carga === undefined ? null : Number(row.carga),
    reps_feitas: row.repeticoes ?? null,
    concluido: !!row.concluida,
  };
}

export function paraRowSerie(serie: Partial<SerieRealizadaInsert>): Record<string, unknown> {
  const { numero_serie, carga_usada, reps_feitas, concluido, ...resto } = serie;
  const row: Record<string, unknown> = { ...resto };
  if (numero_serie !== undefined) row.serie_numero = numero_serie;
  if (carga_usada !== undefined) row.carga = carga_usada;
  if (reps_feitas !== undefined) row.repeticoes = reps_feitas;
  if (concluido !== undefined) row.concluida = concluido;
  return row;
}

export async function createSeriesRealizadas(series: SerieRealizadaInsert[]): Promise<SerieRealizada[]> {
  const { data, error } = await getSupabase()
    .from('series_realizadas')
    .insert(series.map(paraRowSerie))
    .select(COLUNAS_SERIE);

  if (error) throw new AppError(error.message, 'DB_ERROR');
  return (data as SerieRow[]).map(paraSerie);
}

export async function findSeriesBySessao(sessaoId: string): Promise<SerieRealizada[]> {
  const { data, error } = await getSupabase()
    .from('series_realizadas')
    .select(COLUNAS_SERIE)
    .eq('sessao_id', sessaoId)
    .order('serie_numero', { ascending: true });

  if (error) throw new AppError(error.message, 'DB_ERROR');
  return (data as SerieRow[]).map(paraSerie);
}

/**
 * Séries das últimas sessões da pessoa (a mais recente primeiro), sem a sessão em andamento.
 * Base da coluna ANTERIOR e do histórico de cargas: `seriesAnteriores` (shared) escolhe a última vez de cada exercício.
 */
export async function findSeriesRecentes(
  userId: string,
  exercicioIds: string[],
  { excluirSessaoId, limiteSessoes = 30 }: { excluirSessaoId?: string | null; limiteSessoes?: number } = {},
): Promise<{ sessoes: { id: string; inicio: string }[]; series: SerieRealizada[] }> {
  if (exercicioIds.length === 0) return { sessoes: [], series: [] };
  let consulta = getSupabase()
    .from('sessoes_treino')
    .select('id, inicio')
    .eq('user_id', userId);
  if (excluirSessaoId) consulta = consulta.neq('id', excluirSessaoId);
  const { data: sessoes, error } = await consulta.order('inicio', { ascending: false }).limit(limiteSessoes);
  if (error) throw new AppError(error.message, 'DB_ERROR');
  const lista = (sessoes ?? []) as { id: string; inicio: string }[];
  if (lista.length === 0) return { sessoes: [], series: [] };

  const { data: series, error: erroSeries } = await getSupabase()
    .from('series_realizadas')
    .select(COLUNAS_SERIE)
    .in('sessao_id', lista.map((s) => s.id))
    .in('exercicio_id', exercicioIds);
  if (erroSeries) throw new AppError(erroSeries.message, 'DB_ERROR');
  return { sessoes: lista, series: (series as SerieRow[]).map(paraSerie) };
}

/**
 * Busca as últimas séries realizadas de um exercício específico.
 * Usado pelo analisador de carga para sugerir progressão.
 */
export async function findSeriesByExercicioId(
  exercicioId: string,
  limit = 20,
): Promise<SerieRealizada[]> {
  const { data, error } = await getSupabase()
    .from('series_realizadas')
    .select(COLUNAS_SERIE)
    .eq('exercicio_id', exercicioId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw new AppError(error.message, 'DB_ERROR');
  return (data as SerieRow[]).map(paraSerie);
}

export async function updateSerie(serieId: string, data: Partial<SerieRealizadaInsert>): Promise<SerieRealizada> {
  const { data: updated, error } = await getSupabase()
    .from('series_realizadas')
    .update(paraRowSerie(data))
    .eq('id', serieId)
    .select(COLUNAS_SERIE)
    .single();

  if (error) throw new AppError(error.message, 'DB_ERROR');
  return paraSerie(updated as SerieRow);
}
