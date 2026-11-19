import type { FechamentoCofrinho, MovimentoCofrinho } from '@meudia/shared';
import { AppError } from '@meudia/shared';
import { erroDb, schemaDesatualizado } from './erros-db';
import { getSupabase } from './supabase';

const COLUNAS_MOV = 'id, user_id, tipo, valor, competencia, chave, valor_informado, created_at';
const COLUNAS_FECH = 'user_id, competencia, decisao, valor, created_at';

export interface DadosCofrinho {
  movimentos: MovimentoCofrinho[];
  fechamentos: FechamentoCofrinho[];
}

/** Movimentos e fechamentos do usuário; banco sem a 014 → `null` (a tela cai no total dos bancos). */
export async function carregar(userId: string): Promise<DadosCofrinho | null> {
  const [mov, fech] = await Promise.all([
    getSupabase().from('cofrinho_movimentos').select(COLUNAS_MOV).eq('user_id', userId).order('created_at', { ascending: true }),
    getSupabase().from('cofrinho_fechamentos').select(COLUNAS_FECH).eq('user_id', userId),
  ]);
  if (schemaDesatualizado(mov.error) || schemaDesatualizado(fech.error)) return null;
  if (mov.error) erroDb(mov.error);
  if (fech.error) erroDb(fech.error);
  return {
    movimentos: (mov.data ?? []).map((m) => ({ ...m, valor: Number(m.valor), valor_informado: m.valor_informado === null ? null : Number(m.valor_informado) })) as MovimentoCofrinho[],
    fechamentos: (fech.data ?? []).map((f) => ({ ...f, valor: f.valor === null ? null : Number(f.valor) })) as FechamentoCofrinho[],
  };
}

function erroRpc(error: { message: string; code?: string; hint?: string }): never {
  if (error.code === '22023') {
    const amigavel = error.hint === 'cofrinho_insuficiente' ? 'Esse valor é maior do que tem no Cofrinho.' : 'Confira o valor e tente de novo.';
    throw new AppError(error.message, 'VALIDATION_ERROR', 400, amigavel);
  }
  erroDb(error);
}

/** Congela o ponto de partida (idempotente; sem banco cadastrado não faz nada). */
export async function rpcIniciar(): Promise<void> {
  const { error } = await getSupabase().rpc('cofrinho_iniciar');
  if (error) erroRpc(error);
}

export async function rpcMover(tipo: 'guardar' | 'tirar', valor: number, chave: string): Promise<MovimentoCofrinho | null> {
  const { data, error } = await getSupabase().rpc('cofrinho_mover', { p_tipo: tipo, p_valor: valor, p_chave: chave });
  if (error) erroRpc(error);
  return (Array.isArray(data) ? data[0] ?? null : data) as MovimentoCofrinho | null;
}

/** Sem diferença, não cria nada (`null`). */
export async function rpcCorrigir(valorReal: number, chave: string): Promise<MovimentoCofrinho | null> {
  const { data, error } = await getSupabase().rpc('cofrinho_corrigir', { p_valor_real: valorReal, p_chave: chave });
  if (error) erroRpc(error);
  return (Array.isArray(data) ? data[0] ?? null : data) as MovimentoCofrinho | null;
}

export async function rpcFecharMes(competencia: string, guardar: boolean, valor: number | null): Promise<FechamentoCofrinho> {
  const { data, error } = await getSupabase().rpc('cofrinho_fechar_mes', { p_competencia: competencia, p_guardar: guardar, p_valor: valor });
  if (error) erroRpc(error);
  return data as FechamentoCofrinho;
}
