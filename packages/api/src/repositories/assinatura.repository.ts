import type { Assinatura, AssinaturaInsert } from '@meudia/shared';
import { AppError } from '@meudia/shared';
import { getSupabase } from './supabase';

const COLUMNS = 'id, user_id, nome, valor, dia_vencimento, icone, cor, ativo, created_at';

export async function findByUserId(userId: string): Promise<Assinatura[]> {
  const { data, error } = await getSupabase()
    .from('assinaturas')
    .select(COLUMNS)
    .eq('user_id', userId)
    .eq('ativo', true)
    .order('dia_vencimento', { ascending: true });

  if (error) throw new AppError(error.message, error.code === 'PGRST116' ? 'NOT_FOUND' : 'DB_ERROR', error.code === 'PGRST116' ? 404 : 500);
  return data as Assinatura[];
}

export async function findById(assinaturaId: string, userId: string): Promise<Assinatura> {
  const { data, error } = await getSupabase()
    .from('assinaturas')
    .select(COLUMNS)
    .eq('id', assinaturaId)
    .eq('user_id', userId)
    .single();

  if (error) throw new AppError(error.message, error.code === 'PGRST116' ? 'NOT_FOUND' : 'DB_ERROR', error.code === 'PGRST116' ? 404 : 500);
  return data as Assinatura;
}

export async function create(userId: string, data: AssinaturaInsert): Promise<Assinatura> {
  const { data: created, error } = await getSupabase()
    .from('assinaturas')
    .insert({ ...data, user_id: userId })
    .select(COLUMNS)
    .single();

  if (error) throw new AppError(error.message, error.code === 'PGRST116' ? 'NOT_FOUND' : 'DB_ERROR', error.code === 'PGRST116' ? 404 : 500);
  return created as Assinatura;
}

export async function update(assinaturaId: string, data: Partial<AssinaturaInsert>, userId: string): Promise<Assinatura> {
  const { data: updated, error } = await getSupabase()
    .from('assinaturas')
    .update(data)
    .eq('id', assinaturaId)
    .eq('user_id', userId)
    .select(COLUMNS)
    .single();

  if (error) throw new AppError(error.message, error.code === 'PGRST116' ? 'NOT_FOUND' : 'DB_ERROR', error.code === 'PGRST116' ? 404 : 500);
  return updated as Assinatura;
}

export async function remove(assinaturaId: string, userId: string): Promise<void> {
  const { error } = await getSupabase()
    .from('assinaturas')
    .update({ ativo: false })
    .eq('id', assinaturaId)
    .eq('user_id', userId);

  if (error) throw new AppError(error.message, error.code === 'PGRST116' ? 'NOT_FOUND' : 'DB_ERROR', error.code === 'PGRST116' ? 404 : 500);
}
