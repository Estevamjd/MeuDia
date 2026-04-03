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

  if (error) throw new AppError(error.message, 'DB_ERROR');
  return data as Assinatura[];
}

export async function findById(assinaturaId: string): Promise<Assinatura> {
  const { data, error } = await getSupabase()
    .from('assinaturas')
    .select(COLUMNS)
    .eq('id', assinaturaId)
    .single();

  if (error) throw new AppError(error.message, 'DB_ERROR');
  return data as Assinatura;
}

export async function create(userId: string, data: AssinaturaInsert): Promise<Assinatura> {
  const { data: created, error } = await getSupabase()
    .from('assinaturas')
    .insert({ ...data, user_id: userId })
    .select(COLUMNS)
    .single();

  if (error) throw new AppError(error.message, 'DB_ERROR');
  return created as Assinatura;
}

export async function update(assinaturaId: string, data: Partial<AssinaturaInsert>): Promise<Assinatura> {
  const { data: updated, error } = await getSupabase()
    .from('assinaturas')
    .update(data)
    .eq('id', assinaturaId)
    .select(COLUMNS)
    .single();

  if (error) throw new AppError(error.message, 'DB_ERROR');
  return updated as Assinatura;
}

export async function remove(assinaturaId: string): Promise<void> {
  const { error } = await getSupabase()
    .from('assinaturas')
    .update({ ativo: false })
    .eq('id', assinaturaId);

  if (error) throw new AppError(error.message, 'DB_ERROR');
}
