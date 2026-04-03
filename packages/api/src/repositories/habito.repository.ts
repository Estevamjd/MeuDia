import type { Habito, HabitoInsert, RegistroHabito } from '@meudia/shared';
import { AppError } from '@meudia/shared';
import { getSupabase } from './supabase';

export async function findByUserId(userId: string): Promise<Habito[]> {
  const { data, error } = await getSupabase()
    .from('habitos')
    .select('id, user_id, nome, icone, frequencia, dias_semana, meta, ordem, ativo, created_at')
    .eq('user_id', userId)
    .eq('ativo', true)
    .order('ordem', { ascending: true });

  if (error) throw new AppError(error.message, 'DB_ERROR');
  return data as Habito[];
}

export async function findById(habitoId: string, userId: string): Promise<Habito> {
  const { data, error } = await getSupabase()
    .from('habitos')
    .select('id, user_id, nome, icone, frequencia, dias_semana, meta, ordem, ativo, created_at')
    .eq('id', habitoId)
    .eq('user_id', userId)
    .single();

  if (error) throw new AppError(error.message, 'DB_ERROR');
  return data as Habito;
}

export async function create(userId: string, data: HabitoInsert): Promise<Habito> {
  const { data: created, error } = await getSupabase()
    .from('habitos')
    .insert({ ...data, user_id: userId })
    .select('id, user_id, nome, icone, frequencia, dias_semana, meta, ordem, ativo, created_at')
    .single();

  if (error) throw new AppError(error.message, 'DB_ERROR');
  return created as Habito;
}

export async function update(habitoId: string, data: Partial<HabitoInsert>, userId: string): Promise<Habito> {
  const { data: updated, error } = await getSupabase()
    .from('habitos')
    .update(data)
    .eq('id', habitoId)
    .eq('user_id', userId)
    .select('id, user_id, nome, icone, frequencia, dias_semana, meta, ordem, ativo, created_at')
    .single();

  if (error) throw new AppError(error.message, 'DB_ERROR');
  return updated as Habito;
}

export async function remove(habitoId: string, userId: string): Promise<void> {
  const { error } = await getSupabase()
    .from('habitos')
    .update({ ativo: false })
    .eq('id', habitoId)
    .eq('user_id', userId);

  if (error) throw new AppError(error.message, 'DB_ERROR');
}

export async function findRegistrosByDate(userId: string, date: string): Promise<RegistroHabito[]> {
  const { data, error } = await getSupabase()
    .from('registros_habito')
    .select('id, habito_id, user_id, data, concluido, valor')
    .eq('user_id', userId)
    .eq('data', date);

  if (error) throw new AppError(error.message, 'DB_ERROR');
  return data as RegistroHabito[];
}

export async function findRegistrosByDateRange(
  userId: string,
  startDate: string,
  endDate: string,
): Promise<RegistroHabito[]> {
  const { data, error } = await getSupabase()
    .from('registros_habito')
    .select('id, habito_id, user_id, data, concluido, valor')
    .eq('user_id', userId)
    .gte('data', startDate)
    .lte('data', endDate)
    .order('data', { ascending: true });

  if (error) throw new AppError(error.message, 'DB_ERROR');
  return data as RegistroHabito[];
}

export async function upsertRegistro(
  userId: string,
  habitoId: string,
  date: string,
  concluido: boolean,
  valor: number,
): Promise<RegistroHabito> {
  const { data, error } = await getSupabase()
    .from('registros_habito')
    .upsert(
      {
        user_id: userId,
        habito_id: habitoId,
        data: date,
        concluido,
        valor,
      },
      { onConflict: 'habito_id,data' },
    )
    .select('id, habito_id, user_id, data, concluido, valor')
    .single();

  if (error) throw new AppError(error.message, 'DB_ERROR');
  return data as RegistroHabito;
}
