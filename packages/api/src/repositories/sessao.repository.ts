import type {
  SessaoTreino,
  SessaoTreinoInsert,
  SerieRealizada,
  SerieRealizadaInsert,
} from '@meudia/shared';
import { AppError } from '@meudia/shared';
import { getSupabase } from './supabase';

export async function findByUserAndDateRange(
  userId: string,
  startDate: string,
  endDate: string,
): Promise<SessaoTreino[]> {
  const { data, error } = await getSupabase()
    .from('sessoes_treino')
    .select('id, user_id, treino_id, data, duracao_minutos, concluido, observacao, created_at')
    .eq('user_id', userId)
    .gte('data', startDate)
    .lte('data', endDate)
    .order('data', { ascending: true });

  if (error) throw new AppError(error.message, 'DB_ERROR');
  return data as SessaoTreino[];
}

export async function findById(sessaoId: string): Promise<SessaoTreino> {
  const { data, error } = await getSupabase()
    .from('sessoes_treino')
    .select('id, user_id, treino_id, data, duracao_minutos, concluido, observacao, created_at')
    .eq('id', sessaoId)
    .single();

  if (error) throw new AppError(error.message, 'DB_ERROR');
  return data as SessaoTreino;
}

export async function create(userId: string, data: SessaoTreinoInsert): Promise<SessaoTreino> {
  const { data: created, error } = await getSupabase()
    .from('sessoes_treino')
    .insert({ ...data, user_id: userId })
    .select('id, user_id, treino_id, data, duracao_minutos, concluido, observacao, created_at')
    .single();

  if (error) throw new AppError(error.message, 'DB_ERROR');
  return created as SessaoTreino;
}

export async function update(sessaoId: string, data: Partial<SessaoTreinoInsert>): Promise<SessaoTreino> {
  const { data: updated, error } = await getSupabase()
    .from('sessoes_treino')
    .update(data)
    .eq('id', sessaoId)
    .select('id, user_id, treino_id, data, duracao_minutos, concluido, observacao, created_at')
    .single();

  if (error) throw new AppError(error.message, 'DB_ERROR');
  return updated as SessaoTreino;
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
