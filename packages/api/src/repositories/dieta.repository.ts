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
    .from('registros_agua')
    .select('id, user_id, data, quantidade_ml, meta_ml, created_at, updated_at')
    .eq('user_id', userId)
    .eq('data', date)
    .maybeSingle();

  if (error) throw new AppError(error.message, 'DB_ERROR');
  return (data as unknown) as RegistroAgua | null;
}

export async function upsertRegistroAgua(userId: string, input: RegistroAguaInsert & { data: string }): Promise<RegistroAgua> {
  const { data, error } = await getSupabase()
    .from('registros_agua')
    .upsert(
      { ...input, user_id: userId },
      { onConflict: 'user_id,data' },
    )
    .select('id, user_id, data, quantidade_ml, meta_ml, created_at, updated_at')
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

/** Registros desde `desde` (inclusive), do mais antigo ao mais novo. Base do gráfico 7/30/90 e da média de 7 dias. */
export async function findRegistrosPesoDesde(userId: string, desde: string): Promise<RegistroPeso[]> {
  const { data, error } = await getSupabase()
    .from('registros_peso')
    .select('id, user_id, peso, data, observacao')
    .eq('user_id', userId)
    .gte('data', desde)
    .order('data', { ascending: true })
    .limit(400);

  if (error) throw new AppError(error.message, 'DB_ERROR');
  return ((data ?? []) as unknown as RegistroPeso[]).map((r) => ({ ...r, peso: Number(r.peso) }));
}

/** Peso do dia: `registros_peso` é UNIQUE(user_id, data), então registrar de novo no mesmo dia corrige o valor. */
export async function upsertRegistroPeso(userId: string, input: RegistroPesoInsert & { data: string }): Promise<RegistroPeso> {
  const { data, error } = await getSupabase()
    .from('registros_peso')
    .upsert({ ...input, user_id: userId }, { onConflict: 'user_id,data' })
    .select('id, user_id, peso, data, observacao')
    .single();

  if (error) throw new AppError(error.message, 'DB_ERROR');
  return (data as unknown) as RegistroPeso;
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
