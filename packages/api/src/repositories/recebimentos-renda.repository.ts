import type { RecebimentoRenda } from '@meudia/shared';
import { AppError } from '@meudia/shared';
import { getSupabase } from './supabase';

const COLUMNS = 'id, renda_id, user_id, competencia, recebido_em, transacao_id, created_at';

export async function findByCompetencias(userId: string, competencias: string[]): Promise<RecebimentoRenda[]> {
  if (!competencias.length) return [];
  const { data, error } = await getSupabase().from('recebimentos_renda').select(COLUMNS)
    .eq('user_id', userId).in('competencia', competencias);
  if (error) throw new AppError(error.message, 'DB_ERROR');
  return data as unknown as RecebimentoRenda[];
}

function erroRpc(error: { code?: string; message: string }): never {
  if (error.code === 'P0003' || error.code === '23505') throw new AppError('Renda já recebida neste mês', 'COMPETENCIA_JA_RECEBIDA', 409);
  if (error.code === 'P0002') throw new AppError('Renda ou carteira não encontrada', 'NOT_FOUND', 404);
  if (error.code === '22023') throw new AppError('Competência inválida', 'VALIDATION_ERROR', 400);
  throw new AppError(error.message, 'DB_ERROR', 500);
}

// SECURITY INVOKER: as RPCs filtram auth.uid() e aplicam RLS na sessão do usuário.
export async function rpcReceber(rendaId: string, competencia: string, recebidoEm?: string, carteiraId?: string | null): Promise<RecebimentoRenda> {
  const { data, error } = await getSupabase().rpc('receber_renda', {
    p_renda_id: rendaId, p_competencia: competencia, p_recebido_em: recebidoEm ?? null, p_carteira_id: carteiraId ?? null,
  });
  if (error) erroRpc(error);
  return data as RecebimentoRenda;
}

export async function rpcDesfazer(rendaId: string, competencia: string): Promise<void> {
  const { error } = await getSupabase().rpc('desfazer_recebimento', { p_renda_id: rendaId, p_competencia: competencia });
  if (error) erroRpc(error);
}
