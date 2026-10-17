import { paginas } from './cron-pagination';
import type { PagamentoConta } from '@meudia/shared';
import { AppError } from '@meudia/shared';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabase } from './supabase';

const COLUMNS = 'id, conta_id, user_id, competencia, pago_em, transacao_id, created_at';

export async function findByCompetencia(userId: string, competencia: string): Promise<PagamentoConta[]> {
  const { data, error } = await getSupabase().from('pagamentos_conta').select(COLUMNS)
    .eq('user_id', userId).eq('competencia', competencia);
  if (error) throw new AppError(error.message, 'DB_ERROR');
  return data as unknown as PagamentoConta[];
}

export async function findByCompetencias(userId: string, competencias: string[]): Promise<PagamentoConta[]> {
  if (!competencias.length) return [];
  const { data, error } = await getSupabase().from('pagamentos_conta').select(COLUMNS)
    .eq('user_id', userId).in('competencia', competencias);
  if (error) throw new AppError(error.message, 'DB_ERROR');
  return data as unknown as PagamentoConta[];
}

/** Pagamentos ligados às transações informadas (despesa criada pelo "Paguei"). */
export async function findByTransacoes(userId: string, transacaoIds: string[]): Promise<PagamentoConta[]> {
  const unicos = [...new Set(transacaoIds)];
  const rows: PagamentoConta[] = [];
  for (let i = 0; i < unicos.length; i += 100) {
    const { data, error } = await getSupabase().from('pagamentos_conta').select(COLUMNS)
      .eq('user_id', userId).in('transacao_id', unicos.slice(i, i + 100));
    if (error) throw new AppError(error.message, 'DB_ERROR');
    rows.push(...(data ?? []) as unknown as PagamentoConta[]);
  }
  return rows;
}

export async function findByConta(userId: string, contaId: string): Promise<PagamentoConta[]> {
  const { data, error } = await getSupabase().from('pagamentos_conta').select(COLUMNS)
    .eq('user_id', userId).eq('conta_id', contaId).order('competencia', { ascending: false });
  if (error) throw new AppError(error.message, 'DB_ERROR');
  return data as unknown as PagamentoConta[];
}

export async function pagamentosDasCompetenciasParaCron(client: SupabaseClient, competencias: string[], usuarios: string[]): Promise<PagamentoConta[]> {
  if (!competencias.length || !usuarios.length) return [];
  const pagamentos: PagamentoConta[] = [];
  for (let i = 0; i < usuarios.length; i += 100) {
    pagamentos.push(...await paginas(() => client.from('pagamentos_conta').select(COLUMNS)
      .in('competencia', competencias).in('user_id', usuarios.slice(i, i + 100)).order('id')) as unknown as PagamentoConta[]);
  }
  return pagamentos;
}
