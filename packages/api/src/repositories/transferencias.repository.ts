import type { Transferencia, TransferenciaInsert } from '@meudia/shared';
import { AppError } from '@meudia/shared';
import { getSupabase } from './supabase';

const COLUMNS = 'id, user_id, origem_id, destino_id, valor, data, descricao, created_at';

export async function findDesde(userId: string, desde: string): Promise<Transferencia[]> {
  const { data, error } = await getSupabase().from('transferencias').select(COLUMNS)
    .eq('user_id', userId).gte('data', desde).order('data', { ascending: true });
  if (error) throw new AppError(error.message, 'DB_ERROR');
  return data as unknown as Transferencia[];
}

export async function create(userId: string, input: TransferenciaInsert): Promise<Transferencia> {
  const { data, error } = await getSupabase().from('transferencias').insert({ ...input, user_id: userId }).select(COLUMNS).single();
  if (error?.code === '23503') throw new AppError('Carteira não encontrada', 'NOT_FOUND', 404);
  if (error) throw new AppError(error.message, 'DB_ERROR');
  return data as unknown as Transferencia;
}

export async function remove(id: string, userId: string): Promise<void> {
  const { error } = await getSupabase().from('transferencias').delete().eq('id', id).eq('user_id', userId);
  if (error) throw new AppError(error.message, 'DB_ERROR');
}
