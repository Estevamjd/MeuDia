import type { Renda } from '@meudia/shared';
import { AppError } from '@meudia/shared';
import { getSupabase } from './supabase';

const COLUMNS = 'id, user_id, descricao, valor, dia_recebimento, ativo, created_at, updated_at';
type Insert = Omit<Renda, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'dia_recebimento' | 'ativo'> & { dia_recebimento?: number | null; ativo?: boolean };

export async function findAll(userId: string, filters: { ativo?: boolean } = {}): Promise<Renda[]> {
  let query = getSupabase().from('rendas').select(COLUMNS).eq('user_id', userId);
  if (filters.ativo !== undefined) query = query.eq('ativo', filters.ativo);
  const { data, error } = await query.order('created_at', { ascending: false });
  if (error) throw new AppError(error.message, error.code === 'PGRST116' ? 'NOT_FOUND' : 'DB_ERROR', error.code === 'PGRST116' ? 404 : 500);
  return data as unknown as Renda[];
}

export async function findById(id: string, userId: string): Promise<Renda> {
  const { data, error } = await getSupabase().from('rendas').select(COLUMNS).eq('id', id).eq('user_id', userId).single();
  if (error) throw new AppError(error.message, error.code === 'PGRST116' ? 'NOT_FOUND' : 'DB_ERROR', error.code === 'PGRST116' ? 404 : 500);
  return data as unknown as Renda;
}

export async function create(userId: string, input: Insert): Promise<Renda> {
  const { data, error } = await getSupabase().from('rendas').insert({ ...input, user_id: userId }).select(COLUMNS).single();
  if (error) throw new AppError(error.message, error.code === 'PGRST116' ? 'NOT_FOUND' : 'DB_ERROR', error.code === 'PGRST116' ? 404 : 500);
  return data as unknown as Renda;
}

export async function update(id: string, input: Partial<Insert>, userId: string): Promise<Renda> {
  const { data, error } = await getSupabase().from('rendas').update(input).eq('id', id).eq('user_id', userId).select(COLUMNS).single();
  if (error) throw new AppError(error.message, error.code === 'PGRST116' ? 'NOT_FOUND' : 'DB_ERROR', error.code === 'PGRST116' ? 404 : 500);
  return data as unknown as Renda;
}

export async function remove(id: string, userId: string): Promise<void> {
  const { error } = await getSupabase().from('rendas').delete().eq('id', id).eq('user_id', userId);
  if (error) throw new AppError(error.message, error.code === 'PGRST116' ? 'NOT_FOUND' : 'DB_ERROR', error.code === 'PGRST116' ? 404 : 500);
}
