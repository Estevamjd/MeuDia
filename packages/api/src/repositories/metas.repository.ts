import type { Meta, MetaInsert } from '@meudia/shared';
import { AppError } from '@meudia/shared';
import { erroDb } from './erros-db';
import { getSupabase } from './supabase';

const COLUMNS = 'id, user_id, nome, icone, valor_alvo, data_limite, valor_guardado, criado_em, updated_at';

export type MetaUpdate = Partial<MetaInsert> & { valor_guardado?: number };

function erro(error: { message: string; code?: string }): never {
  if (error.code === 'PGRST116') throw new AppError('Meta não encontrada', 'NOT_FOUND', 404);
  erroDb(error);
}

export async function findAll(userId: string): Promise<Meta[]> {
  const { data, error } = await getSupabase().from('metas').select(COLUMNS).eq('user_id', userId)
    .order('criado_em', { ascending: true });
  if (error) erro(error);
  return data as unknown as Meta[];
}

export async function create(userId: string, input: MetaInsert): Promise<Meta> {
  const { data, error } = await getSupabase().from('metas').insert({ ...input, user_id: userId }).select(COLUMNS).single();
  if (error) erro(error);
  return data as unknown as Meta;
}

export async function update(id: string, input: MetaUpdate, userId: string): Promise<Meta> {
  const { data, error } = await getSupabase().from('metas').update(input).eq('id', id).eq('user_id', userId).select(COLUMNS).single();
  if (error) erro(error);
  return data as unknown as Meta;
}

export async function remove(id: string, userId: string): Promise<void> {
  const { error } = await getSupabase().from('metas').delete().eq('id', id).eq('user_id', userId);
  if (error) erro(error);
}

/** "Guardei": soma atômica no banco (guardar_na_meta, 007). P0002: meta de outro usuário/inexistente; 22023: valor. */
export async function rpcGuardar(id: string, valor: number): Promise<Meta> {
  const { data, error } = await getSupabase().rpc('guardar_na_meta', { p_meta_id: id, p_valor: valor });
  if (error?.code === 'P0002') throw new AppError(error.message, 'NOT_FOUND', 404, 'Meta não encontrada.');
  if (error?.code === '22023') throw new AppError(error.message, 'VALIDATION_ERROR', 400, 'Valor inválido.');
  if (error) erro(error);
  return data as Meta;
}
