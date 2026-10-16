import type { OrcamentoCategoria } from '@meudia/shared';
import { AppError } from '@meudia/shared';
import { getSupabase } from './supabase';

const COLUMNS = 'id, user_id, categoria, valor_planejado, created_at, updated_at';
type Insert = Pick<OrcamentoCategoria, 'categoria' | 'valor_planejado'>;

export async function findAll(userId: string): Promise<OrcamentoCategoria[]> {
  const query = getSupabase().from('orcamento_categorias').select(COLUMNS).eq('user_id', userId);
  const { data, error } = await query.order('created_at', { ascending: false });
  if (error) throw new AppError(error.message, error.code === 'PGRST116' ? 'NOT_FOUND' : 'DB_ERROR', error.code === 'PGRST116' ? 404 : 500);
  return data as unknown as OrcamentoCategoria[];
}

export async function findById(id: string, userId: string): Promise<OrcamentoCategoria> {
  const { data, error } = await getSupabase().from('orcamento_categorias').select(COLUMNS).eq('id', id).eq('user_id', userId).single();
  if (error) throw new AppError(error.message, error.code === 'PGRST116' ? 'NOT_FOUND' : 'DB_ERROR', error.code === 'PGRST116' ? 404 : 500);
  return data as unknown as OrcamentoCategoria;
}

export async function create(userId: string, input: Insert): Promise<OrcamentoCategoria> {
  const { data, error } = await getSupabase().from('orcamento_categorias').insert({ ...input, user_id: userId }).select(COLUMNS).single();
  if (error) throw new AppError(error.message, error.code === 'PGRST116' ? 'NOT_FOUND' : 'DB_ERROR', error.code === 'PGRST116' ? 404 : 500);
  return data as unknown as OrcamentoCategoria;
}

export async function update(id: string, input: Partial<Insert>, userId: string): Promise<OrcamentoCategoria> {
  const { data, error } = await getSupabase().from('orcamento_categorias').update(input).eq('id', id).eq('user_id', userId).select(COLUMNS).single();
  if (error) throw new AppError(error.message, error.code === 'PGRST116' ? 'NOT_FOUND' : 'DB_ERROR', error.code === 'PGRST116' ? 404 : 500);
  return data as unknown as OrcamentoCategoria;
}

export async function remove(id: string, userId: string): Promise<void> {
  const { error } = await getSupabase().from('orcamento_categorias').delete().eq('id', id).eq('user_id', userId);
  if (error) throw new AppError(error.message, error.code === 'PGRST116' ? 'NOT_FOUND' : 'DB_ERROR', error.code === 'PGRST116' ? 404 : 500);
}

export async function upsert(userId: string, input: Insert): Promise<OrcamentoCategoria> {
  const { data, error } = await getSupabase().from('orcamento_categorias')
    .upsert({ ...input, user_id: userId }, { onConflict: 'user_id,categoria' })
    .select(COLUMNS).single();
  if (error) throw new AppError(error.message, error.code === 'PGRST116' ? 'NOT_FOUND' : 'DB_ERROR', error.code === 'PGRST116' ? 404 : 500);
  return data as unknown as OrcamentoCategoria;
}
