import type { Compromisso, CompromissoInsert } from '@meudia/shared';
import { AppError } from '@meudia/shared';
import { getSupabase } from './supabase';

const COLUMNS =
  'id, user_id, titulo, descricao, data_inicio, data_fim, local, tipo, prioridade, concluido, created_at';

export async function findByUserId(userId: string): Promise<Compromisso[]> {
  const { data, error } = await getSupabase()
    .from('compromissos')
    .select(COLUMNS)
    .eq('user_id', userId)
    .order('data_inicio', { ascending: true });

  if (error) throw new AppError(error.message, 'DB_ERROR');
  return data as unknown as Compromisso[];
}

export async function findByDateRange(
  userId: string,
  startDate: string,
  endDate: string,
): Promise<Compromisso[]> {
  const { data, error } = await getSupabase()
    .from('compromissos')
    .select(COLUMNS)
    .eq('user_id', userId)
    .gte('data_inicio', startDate)
    .lte('data_inicio', endDate)
    .order('data_inicio', { ascending: true });

  if (error) throw new AppError(error.message, 'DB_ERROR');
  return data as unknown as Compromisso[];
}

export async function findById(compromissoId: string, userId: string): Promise<Compromisso> {
  const { data, error } = await getSupabase()
    .from('compromissos')
    .select(COLUMNS)
    .eq('id', compromissoId)
    .eq('user_id', userId)
    .single();

  if (error) throw new AppError(error.message, 'DB_ERROR');
  return data as unknown as Compromisso;
}

export async function create(userId: string, input: CompromissoInsert): Promise<Compromisso> {
  const { data: created, error } = await getSupabase()
    .from('compromissos')
    .insert({ ...input, user_id: userId })
    .select(COLUMNS)
    .single();

  if (error) throw new AppError(error.message, 'DB_ERROR');
  return created as unknown as Compromisso;
}

export async function update(
  compromissoId: string,
  input: Partial<CompromissoInsert>,
  userId: string,
): Promise<Compromisso> {
  const { data: updated, error } = await getSupabase()
    .from('compromissos')
    .update(input)
    .eq('id', compromissoId)
    .eq('user_id', userId)
    .select(COLUMNS)
    .single();

  if (error) throw new AppError(error.message, 'DB_ERROR');
  return updated as unknown as Compromisso;
}

export async function remove(compromissoId: string, userId: string): Promise<void> {
  const { error } = await getSupabase()
    .from('compromissos')
    .delete()
    .eq('id', compromissoId)
    .eq('user_id', userId);

  if (error) throw new AppError(error.message, 'DB_ERROR');
}
