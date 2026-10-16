import { paginas } from './cron-pagination';
import type { ContaPagar, ContaPagarInsert, PagamentoConta } from '@meudia/shared';
import type { SupabaseClient } from '@supabase/supabase-js';
import { AppError } from '@meudia/shared';
import { getSupabase } from './supabase';

const COLUMNS = 'id, user_id, assinatura_id, descricao, categoria, valor, recorrencia, dia_vencimento, mes_vencimento, data_vencimento, ativo, created_at, updated_at';
type Insert = ContaPagarInsert;

export async function findAll(userId: string, filters: { ativo?: boolean } = {}): Promise<ContaPagar[]> {
  let query = getSupabase().from('contas_pagar').select(COLUMNS).eq('user_id', userId);
  if (filters.ativo !== undefined) query = query.eq('ativo', filters.ativo);
  const { data, error } = await query.order('created_at', { ascending: false });
  if (error) throw new AppError(error.message, error.code === 'PGRST116' ? 'NOT_FOUND' : 'DB_ERROR', error.code === 'PGRST116' ? 404 : 500);
  return data as unknown as ContaPagar[];
}

export async function findById(id: string, userId: string, client = getSupabase()): Promise<ContaPagar> {
  const { data, error } = await client.from('contas_pagar').select(COLUMNS).eq('id', id).eq('user_id', userId).single();
  if (error) throw new AppError(error.message, error.code === 'PGRST116' ? 'NOT_FOUND' : 'DB_ERROR', error.code === 'PGRST116' ? 404 : 500);
  return data as unknown as ContaPagar;
}

export async function create(userId: string, input: Insert): Promise<ContaPagar> {
  const { data, error } = await getSupabase().from('contas_pagar').insert({ ...input, user_id: userId }).select(COLUMNS).single();
  if (error?.code === '23505') throw new AppError('Conta espelho duplicada', 'CONFLICT', 409);
  if (error) throw new AppError(error.message, error.code === 'PGRST116' ? 'NOT_FOUND' : 'DB_ERROR', error.code === 'PGRST116' ? 404 : 500);
  return data as unknown as ContaPagar;
}

export async function update(id: string, input: Partial<Insert>, userId: string): Promise<ContaPagar> {
  const { data, error } = await getSupabase().from('contas_pagar').update(input).eq('id', id).eq('user_id', userId).select(COLUMNS).single();
  if (error?.code === '23505') throw new AppError('Conta espelho duplicada', 'CONFLICT', 409);
  if (error) throw new AppError(error.message, error.code === 'PGRST116' ? 'NOT_FOUND' : 'DB_ERROR', error.code === 'PGRST116' ? 404 : 500);
  return data as unknown as ContaPagar;
}

export async function findByAssinatura(assinaturaId: string, userId: string): Promise<ContaPagar | null> {
  const { data, error } = await getSupabase().from('contas_pagar').select(COLUMNS)
    .eq('assinatura_id', assinaturaId).eq('user_id', userId).maybeSingle();
  if (error) throw new AppError(error.message, error.code === 'PGRST116' ? 'NOT_FOUND' : 'DB_ERROR', error.code === 'PGRST116' ? 404 : 500);
  return data as unknown as ContaPagar | null;
}

// SECURITY INVOKER: as RPCs filtram auth.uid() e aplicam RLS na sessão do usuário.
export async function rpcPagar(contaId: string, competencia: string, pagoEm?: string, banco?: string | null, client = getSupabase()) {
  const { data, error } = await client.rpc('pagar_conta', {
    p_conta_id: contaId, p_competencia: competencia, p_pago_em: pagoEm ?? null, p_banco: banco ?? null,
  });
  if (error) {
    if (error.code === 'P0003' || error.code === '23505') throw new AppError('Competência já paga', 'COMPETENCIA_JA_PAGA', 409);
    if (error.code === 'P0002') throw new AppError('Conta não encontrada', 'NOT_FOUND', 404);
    if (error.code === '22023') throw new AppError('Competência inválida', 'VALIDATION_ERROR', 400);
    throw new AppError(error.message, 'DB_ERROR', 500);
  }
  return data as PagamentoConta;
}

// SECURITY INVOKER: auth.uid() + RLS garantem o isolamento do usuário.
export async function rpcDesfazer(contaId: string, competencia: string): Promise<void> {
  const { error } = await getSupabase().rpc('desfazer_pagamento', { p_conta_id: contaId, p_competencia: competencia });
  if (error) throw new AppError(error.message, error.code === 'PGRST116' ? 'NOT_FOUND' : 'DB_ERROR', error.code === 'PGRST116' ? 404 : 500);
}

export async function contasAtivasComInscricaoParaCron(client: SupabaseClient): Promise<ContaPagar[]> {
  const inscricoes = await paginas(() => client.from('push_subscriptions').select('id, user_id').order('id'));
  const usuarios = [...new Set(inscricoes.map(row => row.user_id as string))];
  const contas: ContaPagar[] = [];
  for (let i = 0; i < usuarios.length; i += 100) {
    contas.push(...await paginas(() => client.from('contas_pagar').select(COLUMNS).eq('ativo', true)
      .in('user_id', usuarios.slice(i, i + 100)).order('id')) as unknown as ContaPagar[]);
  }
  return contas;
}
