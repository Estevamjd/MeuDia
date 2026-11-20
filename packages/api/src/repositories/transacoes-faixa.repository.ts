import type { Transacao } from '@meudia/shared';
import { paginasPorChave } from './cron-pagination';
import { erroDb } from './erros-db';
import { getSupabase } from './supabase';

import { COLUMNS } from './transacao.repository';

/**
 * Lançamentos do dono com `inicio <= data <= fim` (ISO AAAA-MM-DD), em ordem (data, id) crescente. Paginado por
 * chave: uma faixa de vários meses pode passar do `max-rows` do PostgREST e não pode voltar truncada.
 */
export async function findEntre(userId: string, inicio: string, fim: string): Promise<Transacao[]> {
  const rows = await paginasPorChave(
    () => getSupabase().from('transacoes').select(COLUMNS)
      .eq('user_id', userId).gte('data', inicio).lte('data', fim),
    erroDb,
  );
  return rows as unknown as Transacao[];
}
