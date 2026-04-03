import type { Transacao, TransacaoInsert } from '@meudia/shared';
import { AppError } from '@meudia/shared';
import { getSupabase } from './supabase';

const COLUMNS = 'id, user_id, tipo, categoria, descricao, valor, data, banco, automatico, created_at';

export async function findByUserId(userId: string): Promise<Transacao[]> {
  const { data, error } = await getSupabase()
    .from('transacoes')
    .select(COLUMNS)
    .eq('user_id', userId)
    .order('data', { ascending: false });

  if (error) throw new AppError(error.message, 'DB_ERROR');
  return data as unknown as Transacao[];
}

export async function findByDateRange(
  userId: string,
  startDate: string,
  endDate: string,
): Promise<Transacao[]> {
  const { data, error } = await getSupabase()
    .from('transacoes')
    .select(COLUMNS)
    .eq('user_id', userId)
    .gte('data', startDate)
    .lte('data', endDate)
    .order('data', { ascending: false });

  if (error) throw new AppError(error.message, 'DB_ERROR');
  return data as unknown as Transacao[];
}

export async function findById(transacaoId: string, userId: string): Promise<Transacao> {
  const { data, error } = await getSupabase()
    .from('transacoes')
    .select(COLUMNS)
    .eq('id', transacaoId)
    .eq('user_id', userId)
    .single();

  if (error) throw new AppError(error.message, 'DB_ERROR');
  return data as unknown as Transacao;
}

export async function create(userId: string, data: TransacaoInsert): Promise<Transacao> {
  const { data: created, error } = await getSupabase()
    .from('transacoes')
    .insert({ ...data, user_id: userId })
    .select(COLUMNS)
    .single();

  if (error) throw new AppError(error.message, 'DB_ERROR');
  return created as unknown as Transacao;
}

export async function update(transacaoId: string, data: Partial<TransacaoInsert>, userId: string): Promise<Transacao> {
  const { data: updated, error } = await getSupabase()
    .from('transacoes')
    .update(data)
    .eq('id', transacaoId)
    .eq('user_id', userId)
    .select(COLUMNS)
    .single();

  if (error) throw new AppError(error.message, 'DB_ERROR');
  return updated as unknown as Transacao;
}

export async function remove(transacaoId: string, userId: string): Promise<void> {
  const { error } = await getSupabase()
    .from('transacoes')
    .delete()
    .eq('id', transacaoId)
    .eq('user_id', userId);

  if (error) throw new AppError(error.message, 'DB_ERROR');
}
