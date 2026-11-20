import type { Refeicao, RefeicaoInsert, RegistroPeso, RegistroPesoInsert } from '@meudia/shared';
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

export async function updateRefeicao(refeicaoId: string, input: Partial<RefeicaoInsert>, userId: string): Promise<Refeicao> {
  const { data, error } = await getSupabase()
    .from('refeicoes')
    .update(input)
    .eq('id', refeicaoId)
    .eq('user_id', userId)
    .select('id, user_id, tipo, data, items, total_calorias, total_proteina, total_carbo, total_gordura')
    .single();

  if (error) throw new AppError(error.message, 'DB_ERROR');
  return (data as unknown) as Refeicao;
}

export async function removeRefeicao(refeicaoId: string, userId: string): Promise<void> {
  const { error } = await getSupabase()
    .from('refeicoes')
    .delete()
    .eq('id', refeicaoId)
    .eq('user_id', userId);

  if (error) throw new AppError(error.message, 'DB_ERROR');
}

// ── Registro de Peso ──

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
