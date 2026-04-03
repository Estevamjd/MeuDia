import type { Veiculo, VeiculoInsert, Manutencao, ManutencaoInsert } from '@meudia/shared';
import { AppError } from '@meudia/shared';
import { getSupabase } from './supabase';

const VEICULO_COLUMNS = 'id, user_id, modelo, placa, ano, km_atual, created_at';
const MANUTENCAO_COLUMNS = 'id, veiculo_id, tipo, data, km_na_revisao, custo, proxima_revisao_km, observacao';

export async function findByUserId(userId: string): Promise<Veiculo[]> {
  const { data, error } = await getSupabase()
    .from('veiculos')
    .select(VEICULO_COLUMNS)
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw new AppError(error.message, 'DB_ERROR');
  return data as unknown as Veiculo[];
}

export async function findById(veiculoId: string): Promise<Veiculo> {
  const { data, error } = await getSupabase()
    .from('veiculos')
    .select(VEICULO_COLUMNS)
    .eq('id', veiculoId)
    .single();

  if (error) throw new AppError(error.message, 'DB_ERROR');
  return data as unknown as Veiculo;
}

export async function create(userId: string, data: VeiculoInsert): Promise<Veiculo> {
  const { data: created, error } = await getSupabase()
    .from('veiculos')
    .insert({ ...data, user_id: userId })
    .select(VEICULO_COLUMNS)
    .single();

  if (error) throw new AppError(error.message, 'DB_ERROR');
  return created as unknown as Veiculo;
}

export async function update(veiculoId: string, data: Partial<VeiculoInsert>): Promise<Veiculo> {
  const { data: updated, error } = await getSupabase()
    .from('veiculos')
    .update(data)
    .eq('id', veiculoId)
    .select(VEICULO_COLUMNS)
    .single();

  if (error) throw new AppError(error.message, 'DB_ERROR');
  return updated as unknown as Veiculo;
}

export async function remove(veiculoId: string): Promise<void> {
  const { error } = await getSupabase()
    .from('veiculos')
    .delete()
    .eq('id', veiculoId);

  if (error) throw new AppError(error.message, 'DB_ERROR');
}

export async function findManutencoesByVeiculoId(veiculoId: string): Promise<Manutencao[]> {
  const { data, error } = await getSupabase()
    .from('manutencoes')
    .select(MANUTENCAO_COLUMNS)
    .eq('veiculo_id', veiculoId)
    .order('data', { ascending: false });

  if (error) throw new AppError(error.message, 'DB_ERROR');
  return data as unknown as Manutencao[];
}

export async function createManutencao(data: ManutencaoInsert): Promise<Manutencao> {
  const { data: created, error } = await getSupabase()
    .from('manutencoes')
    .insert(data)
    .select(MANUTENCAO_COLUMNS)
    .single();

  if (error) throw new AppError(error.message, 'DB_ERROR');
  return created as unknown as Manutencao;
}

export async function updateManutencao(
  manutencaoId: string,
  data: Partial<ManutencaoInsert>,
): Promise<Manutencao> {
  const { data: updated, error } = await getSupabase()
    .from('manutencoes')
    .update(data)
    .eq('id', manutencaoId)
    .select(MANUTENCAO_COLUMNS)
    .single();

  if (error) throw new AppError(error.message, 'DB_ERROR');
  return updated as unknown as Manutencao;
}

export async function removeManutencao(manutencaoId: string): Promise<void> {
  const { error } = await getSupabase()
    .from('manutencoes')
    .delete()
    .eq('id', manutencaoId);

  if (error) throw new AppError(error.message, 'DB_ERROR');
}
