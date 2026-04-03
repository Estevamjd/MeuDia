import type { Treino, TreinoInsert } from '@meudia/shared';
import { AppError } from '@meudia/shared';
import { getSupabase } from './supabase';

export async function findByUserId(userId: string): Promise<Treino[]> {
  const { data, error } = await getSupabase()
    .from('treinos')
    .select('*, exercicios(*)')
    .eq('user_id', userId)
    .order('ordem', { ascending: true });

  if (error) throw new AppError(error.message, 'DB_ERROR');
  return data as Treino[];
}

export async function findById(treinoId: string, userId: string): Promise<Treino> {
  const { data, error } = await getSupabase()
    .from('treinos')
    .select('*, exercicios(*)')
    .eq('id', treinoId)
    .eq('user_id', userId)
    .single();

  if (error) throw new AppError(error.message, 'DB_ERROR');
  return data as Treino;
}

export async function create(userId: string, data: TreinoInsert): Promise<Treino> {
  const { data: created, error } = await getSupabase()
    .from('treinos')
    .insert({ ...data, user_id: userId })
    .select('id, user_id, nome, dia_semana, tipo, observacao, ordem, created_at')
    .single();

  if (error) throw new AppError(error.message, 'DB_ERROR');
  return created as Treino;
}

export async function update(treinoId: string, data: Partial<TreinoInsert>, userId: string): Promise<Treino> {
  const { data: updated, error } = await getSupabase()
    .from('treinos')
    .update(data)
    .eq('id', treinoId)
    .eq('user_id', userId)
    .select('id, user_id, nome, dia_semana, tipo, observacao, ordem, created_at')
    .single();

  if (error) throw new AppError(error.message, 'DB_ERROR');
  return updated as Treino;
}

export async function remove(treinoId: string, userId: string): Promise<void> {
  const { error } = await getSupabase()
    .from('treinos')
    .delete()
    .eq('id', treinoId)
    .eq('user_id', userId);

  if (error) throw new AppError(error.message, 'DB_ERROR');
}
