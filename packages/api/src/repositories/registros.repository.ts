import type { RegistroRefeicao, RegistroRefeicaoInsert, RegistroTreino, RegistroTreinoInsert } from '@meudia/shared';
import { erroDb } from './erros-db';
import { getSupabase } from './supabase';

const COL_TREINO = 'id, user_id, data, descricao, duracao_min, origem, created_at';
const COL_REFEICAO = 'id, user_id, data, tipo, descricao, origem, created_at';

export async function listarTreinos(userId: string, desdeISO: string): Promise<RegistroTreino[]> {
  const { data, error } = await getSupabase().from('registros_treino').select(COL_TREINO)
    .eq('user_id', userId).gte('data', desdeISO).order('data', { ascending: false }).order('created_at', { ascending: false }).limit(200);
  if (error) erroDb(error);
  return data as unknown as RegistroTreino[];
}

export async function criarTreino(userId: string, input: RegistroTreinoInsert): Promise<RegistroTreino> {
  const { data, error } = await getSupabase().from('registros_treino').insert({ ...input, user_id: userId, origem: 'app' }).select(COL_TREINO).single();
  if (error) erroDb(error);
  return data as unknown as RegistroTreino;
}

export async function excluirTreino(id: string, userId: string): Promise<void> {
  const { error } = await getSupabase().from('registros_treino').delete().eq('id', id).eq('user_id', userId);
  if (error) erroDb(error);
}

export async function listarRefeicoes(userId: string, desdeISO: string): Promise<RegistroRefeicao[]> {
  const { data, error } = await getSupabase().from('registros_refeicao').select(COL_REFEICAO)
    .eq('user_id', userId).gte('data', desdeISO).order('data', { ascending: false }).order('created_at', { ascending: false }).limit(300);
  if (error) erroDb(error);
  return data as unknown as RegistroRefeicao[];
}

export async function criarRefeicao(userId: string, input: RegistroRefeicaoInsert): Promise<RegistroRefeicao> {
  const { data, error } = await getSupabase().from('registros_refeicao').insert({ ...input, user_id: userId, origem: 'app' }).select(COL_REFEICAO).single();
  if (error) erroDb(error);
  return data as unknown as RegistroRefeicao;
}

export async function excluirRefeicao(id: string, userId: string): Promise<void> {
  const { error } = await getSupabase().from('registros_refeicao').delete().eq('id', id).eq('user_id', userId);
  if (error) erroDb(error);
}
