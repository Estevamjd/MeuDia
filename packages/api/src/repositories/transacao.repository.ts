import type { Transacao, TransacaoInsert } from '@meudia/shared';
import { paginasPorChave } from './cron-pagination';
import { erroDb } from './erros-db';
import { getSupabase } from './supabase';

const COLUMNS = 'id, user_id, tipo, categoria, descricao, valor, data, banco, automatico, created_at, carteira_id, ajuste';

export async function findByUserId(userId: string): Promise<Transacao[]> {
  const { data, error } = await getSupabase()
    .from('transacoes')
    .select(COLUMNS)
    .eq('user_id', userId)
    .order('data', { ascending: false });

  if (error) erroDb(error);
  return data as unknown as Transacao[];
}

export async function findByDateRange(
  userId: string,
  startDate: string,
  endDate: string,
): Promise<Transacao[]> {
  const { data, error } = await getSupabase()
    .from('transacoes')
    .select(COLUMNS)
    .eq('user_id', userId)
    .gte('data', startDate)
    .lte('data', endDate)
    .order('data', { ascending: false });

  if (error) erroDb(error);
  return data as unknown as Transacao[];
}

export async function findById(transacaoId: string, userId: string): Promise<Transacao> {
  const { data, error } = await getSupabase()
    .from('transacoes')
    .select(COLUMNS)
    .eq('id', transacaoId)
    .eq('user_id', userId)
    .single();

  if (error) erroDb(error);
  return data as unknown as Transacao;
}

export async function create(userId: string, data: TransacaoInsert): Promise<Transacao> {
  const { data: created, error } = await getSupabase()
    .from('transacoes')
    .insert({ ...data, user_id: userId })
    .select(COLUMNS)
    .single();

  if (error) erroDb(error);
  return created as unknown as Transacao;
}

export async function update(transacaoId: string, data: Partial<TransacaoInsert>, userId: string): Promise<Transacao> {
  const { data: updated, error } = await getSupabase()
    .from('transacoes')
    .update(data)
    .eq('id', transacaoId)
    .eq('user_id', userId)
    .select(COLUMNS)
    .single();

  if (error) erroDb(error);
  return updated as unknown as Transacao;
}

export async function remove(transacaoId: string, userId: string): Promise<void> {
  const { error } = await getSupabase()
    .from('transacoes')
    .delete()
    .eq('id', transacaoId)
    .eq('user_id', userId);

  if (error) erroDb(error);
}

/** Inclui pagamentos cuja data de caixa cai fora da competência exibida. */
export async function findByIds(userId: string, ids: string[]): Promise<Transacao[]> {
  const rows: Transacao[] = [];
  const unicos = [...new Set(ids)];
  for (let i = 0; i < unicos.length; i += 100) {
    const { data, error } = await getSupabase().from('transacoes').select(COLUMNS)
      .eq('user_id', userId).in('id', unicos.slice(i, i + 100));
    if (error) erroDb(error);
    rows.push(...(data ?? []) as unknown as Transacao[]);
  }
  return rows;
}

/**
 * Lançamentos com carteira a partir de `desde` (a âncora mais antiga): base do saldo.
 * Paginado por chave (data, id) até esgotar: o PostgREST corta cada resposta no `max-rows` do projeto.
 */
export async function findComCarteiraDesde(userId: string, desde: string): Promise<Transacao[]> {
  const rows = await paginasPorChave(
    () => getSupabase().from('transacoes').select(COLUMNS)
      .eq('user_id', userId).not('carteira_id', 'is', null).gte('data', desde),
    erroDb,
  );
  return rows as unknown as Transacao[];
}
