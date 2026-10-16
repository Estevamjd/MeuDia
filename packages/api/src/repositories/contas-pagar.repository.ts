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
  if (error) throw new AppError(error.message, 'DB_ERROR');
  return data as unknown as ContaPagar[];
}

export async function findById(id: string, userId: string): Promise<ContaPagar> {
  const { data, error } = await getSupabase().from('contas_pagar').select(COLUMNS).eq('id', id).eq('user_id', userId).single();
  if (error) throw new AppError(error.message, 'DB_ERROR');
  return data as unknown as ContaPagar;
}

export async function create(userId: string, input: Insert): Promise<ContaPagar> {
  const { data, error } = await getSupabase().from('contas_pagar').insert({ ...input, user_id: userId }).eq('user_id', userId).select(COLUMNS).single();
  if (error) throw new AppError(error.message, 'DB_ERROR');
  return data as unknown as ContaPagar;
}

export async function update(id: string, input: Partial<Insert>, userId: string): Promise<ContaPagar> {
  const { data, error } = await getSupabase().from('contas_pagar').update(input).eq('id', id).eq('user_id', userId).select(COLUMNS).single();
  if (error) throw new AppError(error.message, 'DB_ERROR');
  return data as unknown as ContaPagar;
}

export async function findByAssinatura(assinaturaId: string, userId: string): Promise<ContaPagar | null> {
  const { data, error } = await getSupabase().from('contas_pagar').select(COLUMNS)
    .eq('assinatura_id', assinaturaId).eq('user_id', userId).maybeSingle();
  if (error) throw new AppError(error.message, 'DB_ERROR');
  return data as unknown as ContaPagar | null;
}

// SECURITY INVOKER: as RPCs filtram auth.uid() e aplicam RLS na sessão do usuário.
export async function rpcPagar(contaId: string, competencia: string, pagoEm?: string, banco?: string | null) {
  const { data, error } = await getSupabase().rpc('pagar_conta', {
    p_conta_id: contaId, p_competencia: competencia, p_pago_em: pagoEm ?? null, p_banco: banco ?? null,
  });
  if (error) throw new AppError(error.message, 'DB_ERROR');
  return data as PagamentoConta;
}

// SECURITY INVOKER: auth.uid() + RLS garantem o isolamento do usuário.
export async function rpcDesfazer(contaId: string, competencia: string): Promise<void> {
  const { error } = await getSupabase().rpc('desfazer_pagamento', { p_conta_id: contaId, p_competencia: competencia });
  if (error) throw new AppError(error.message, 'DB_ERROR');
}

export async function contasAtivasComInscricaoParaCron(client: SupabaseClient): Promise<ContaPagar[]> {
  // Não há FK direta conta -> inscrição; selecione usuários inscritos antes das contas.
  const { data: inscricoes, error: erroInscricoes } = await client.from('push_subscriptions').select('user_id');
  if (erroInscricoes) throw new AppError(erroInscricoes.message, 'DB_ERROR');
  const usuarios = [...new Set((inscricoes ?? []).map(row => row.user_id as string))];
  if (!usuarios.length) return [];
  const { data, error } = await client.from('contas_pagar').select(COLUMNS).eq('ativo', true).in('user_id', usuarios);
  if (error) throw new AppError(error.message, 'DB_ERROR');
  return data as unknown as ContaPagar[];
}
