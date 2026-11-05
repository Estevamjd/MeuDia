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

export async function createSeriesRealizadas(series: SerieRealizadaInsert[]): Promise<SerieRealizada[]> {
  const { data, error } = await getSupabase()
    .from('series_realizadas')
    .insert(series)
    .select('id, sessao_id, exercicio_id, numero_serie, carga_usada, reps_feitas, concluido');

  if (error) throw new AppError(error.message, 'DB_ERROR');
  return data as SerieRealizada[];
}

export async function findSeriesBySessao(sessaoId: string): Promise<SerieRealizada[]> {
  const { data, error } = await getSupabase()
    .from('series_realizadas')
    .select('id, sessao_id, exercicio_id, numero_serie, carga_usada, reps_feitas, concluido')
    .eq('sessao_id', sessaoId)
    .order('numero_serie', { ascending: true });

  if (error) throw new AppError(error.message, 'DB_ERROR');
  return data as SerieRealizada[];
}

/**
 * Busca as últimas séries realizadas de um exercício específico (últimas N sessões).
 * Usado pelo analisador de carga para sugerir progressão.
 */
export async function findSeriesByExercicioId(
  exercicioId: string,
  limit = 20,
): Promise<SerieRealizada[]> {
  const { data, error } = await getSupabase()
    .from('series_realizadas')
    .select('id, sessao_id, exercicio_id, numero_serie, carga_usada, reps_feitas, concluido')
    .eq('exercicio_id', exercicioId)
    .order('sessao_id', { ascending: false })
    .limit(limit);

  if (error) throw new AppError(error.message, 'DB_ERROR');
  return data as SerieRealizada[];
}

export async function updateSerie(serieId: string, data: Partial<SerieRealizadaInsert>): Promise<SerieRealizada> {
  const { data: updated, error } = await getSupabase()
    .from('series_realizadas')
    .update(data)
    .eq('id', serieId)
    .select('id, sessao_id, exercicio_id, numero_serie, carga_usada, reps_feitas, concluido')
    .single();

  if (error) throw new AppError(error.message, 'DB_ERROR');
  return updated as SerieRealizada;
}
