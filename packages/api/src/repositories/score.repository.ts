import type { ScoreDiario, Conquista } from '@meudia/shared';
import { AppError } from '@meudia/shared';
import { getSupabase } from './supabase';

export async function findByDate(userId: string, date: string): Promise<ScoreDiario | null> {
  const { data, error } = await getSupabase()
    .from('scores_diarios')
    .select('id, user_id, data, score, pts_treino, pts_habitos, pts_agua, pts_calorias, pts_medicamentos')
    .eq('user_id', userId)
    .eq('data', date)
    .maybeSingle();

  if (error) throw new AppError(error.message, 'DB_ERROR');
  return data as ScoreDiario | null;
}

export async function findByDateRange(
  userId: string,
  startDate: string,
  endDate: string,
): Promise<ScoreDiario[]> {
  const { data, error } = await getSupabase()
    .from('scores_diarios')
    .select('id, user_id, data, score, pts_treino, pts_habitos, pts_agua, pts_calorias, pts_medicamentos')
    .eq('user_id', userId)
    .gte('data', startDate)
    .lte('data', endDate)
    .order('data', { ascending: true });

  if (error) throw new AppError(error.message, 'DB_ERROR');
  return data as ScoreDiario[];
}

export async function upsert(
  userId: string,
  data: Omit<ScoreDiario, 'id' | 'user_id'>,
): Promise<ScoreDiario> {
  const { data: upserted, error } = await getSupabase()
    .from('scores_diarios')
    .upsert(
      { ...data, user_id: userId },
      { onConflict: 'user_id,data' },
    )
    .select('id, user_id, data, score, pts_treino, pts_habitos, pts_agua, pts_calorias, pts_medicamentos')
    .single();

  if (error) throw new AppError(error.message, 'DB_ERROR');
  return upserted as ScoreDiario;
}

export async function findConquistas(userId: string): Promise<Conquista[]> {
  const { data, error } = await getSupabase()
    .from('conquistas')
    .select('id, user_id, tipo, titulo, descricao, icone, conquistado_em')
    .eq('user_id', userId)
    .order('conquistado_em', { ascending: false });

  if (error) throw new AppError(error.message, 'DB_ERROR');
  return data as Conquista[];
}

export async function createConquista(
  userId: string,
  data: { tipo: string; titulo: string; descricao: string; icone: string },
): Promise<Conquista> {
  const { data: created, error } = await getSupabase()
    .from('conquistas')
    .insert({ ...data, user_id: userId })
    .select('id, user_id, tipo, titulo, descricao, icone, conquistado_em')
    .single();

  if (error) throw new AppError(error.message, 'DB_ERROR');
  return created as Conquista;
}
