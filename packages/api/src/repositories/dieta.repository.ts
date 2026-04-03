import type { Refeicao, RefeicaoInsert, RegistroAgua, RegistroAguaInsert, RegistroPeso, RegistroPesoInsert } from '@meudia/shared';
import { AppError } from '@meudia/shared';
import { getSupabase } from './supabase';

// ── Refeições ──

export async function findRefeicoesByDate(userId: string, date: string): Promise<Refeicao[]> {
  const { data, error } = await getSupabase()
    .from('refeicoes')
    .select('id, user_id, tipo, data, items, total_calorias, total_proteina, total_carbo, total_gordura')
    .eq('user_id', userId)
    .eq('data', date)
    .order('tipo', { ascending: true });

  if (error) throw new AppError(error.message, 'DB_ERROR');
  return (data as unknown) as Refeicao[];
}

export async function createRefeicao(userId: string, input: RefeicaoInsert): Promise<Refeicao> {
  const { data, error } = await getSupabase()
    .from('refeicoes')
    .insert({ ...input, user_id: userId })
    .select('id, user_id, tipo, data, items, total_calorias, total_proteina, total_carbo, total_gordura')
    .single();

  if (error) throw new AppError(error.message, 'DB_ERROR');
  return (data as unknown) as Refeicao;
}

export async function updateRefeicao(refeicaoId: string, input: Partial<RefeicaoInsert>): Promise<Refeicao> {
  const { data, error } = await getSupabase()
    .from('refeicoes')
    .update(input)
    .eq('id', refeicaoId)
    .select('id, user_id, tipo, data, items, total_calorias, total_proteina, total_carbo, total_gordura')
    .single();

  if (error) throw new AppError(error.message, 'DB_ERROR');
  return (data as unknown) as Refeicao;
}

export async function removeRefeicao(refeicaoId: string): Promise<void> {
  const { error } = await getSupabase()
    .from('refeicoes')
    .delete()
    .eq('id', refeicaoId);

  if (error) throw new AppError(error.message, 'DB_ERROR');
}

// ── Registro de Água ──

export async function findRegistroAguaByDate(userId: string, date: string): Promise<RegistroAgua | null> {
  const { data, error } = await getSupabase()
    .from('registro_agua')
    .select('id, user_id, data, copos_bebidos, meta_copos')
    .eq('user_id', userId)
    .eq('data', date)
    .maybeSingle();

  if (error) throw new AppError(error.message, 'DB_ERROR');
  return (data as unknown) as RegistroAgua | null;
}

export async function upsertRegistroAgua(userId: string, input: RegistroAguaInsert & { data: string }): Promise<RegistroAgua> {
  const { data, error } = await getSupabase()
    .from('registro_agua')
    .upsert(
      { ...input, user_id: userId },
      { onConflict: 'user_id,data' },
    )
    .select('id, user_id, data, copos_bebidos, meta_copos')
    .single();

  if (error) throw new AppError(error.message, 'DB_ERROR');
  return (data as unknown) as RegistroAgua;
}

// ── Registro de Peso ──

export async function findRegistrosPeso(userId: string, limit = 30): Promise<RegistroPeso[]> {
  const { data, error } = await getSupabase()
    .from('registros_peso')
    .select('id, user_id, peso, data, observacao')
    .eq('user_id', userId)
    .order('data', { ascending: false })
    .limit(limit);

  if (error) throw new AppError(error.message, 'DB_ERROR');
  return (data as unknown) as RegistroPeso[];
}

export async function createRegistroPeso(userId: string, input: RegistroPesoInsert): Promise<RegistroPeso> {
  const { data, error } = await getSupabase()
    .from('registros_peso')
    .insert({ ...input, user_id: userId })
    .select('id, user_id, peso, data, observacao')
    .single();

  if (error) throw new AppError(error.message, 'DB_ERROR');
  return (data as unknown) as RegistroPeso;
}
