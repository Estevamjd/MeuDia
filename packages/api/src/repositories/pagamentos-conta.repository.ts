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

export async function findByConta(userId: string, contaId: string): Promise<PagamentoConta[]> {
  const { data, error } = await getSupabase().from('pagamentos_conta').select(COLUMNS)
    .eq('user_id', userId).eq('conta_id', contaId).order('competencia', { ascending: false });
  if (error) throw new AppError(error.message, 'DB_ERROR');
  return data as unknown as PagamentoConta[];
}

export async function pagamentosDasCompetenciasParaCron(client: SupabaseClient, competencias: string[]): Promise<PagamentoConta[]> {
  if (!competencias.length) return [];
  const { data, error } = await client.from('pagamentos_conta').select(COLUMNS).in('competencia', competencias);
  if (error) throw new AppError(error.message, 'DB_ERROR');
  return data as unknown as PagamentoConta[];
}
