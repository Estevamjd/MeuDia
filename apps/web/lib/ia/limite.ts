import type { SupabaseClient } from '@supabase/supabase-js';
import { hojeSP } from '@meudia/shared';

/** STACK-DECISION §3: 50 mensagens/dia por usuário; env opcional `IA_LIMITE_DIARIO`. */
export const LIMITE_DIARIO_PADRAO = 50;

export function limiteDiario(): number {
  const n = Number(process.env.IA_LIMITE_DIARIO);
  return Number.isInteger(n) && n > 0 ? n : LIMITE_DIARIO_PADRAO;
}

/** 00:00 de hoje em São Paulo, em ISO (o Brasil não tem horário de verão desde 2019: UTC−3 fixo). */
export function inicioDoDiaSP(now = new Date()): string {
  return new Date(`${hojeSP(now)}T00:00:00-03:00`).toISOString();
}

/**
 * Conta as mensagens do próprio usuário hoje (BRT) em `chat_agente`, sem migração.
 * A rota grava a mensagem antes de contar, então a atual entra na conta.
 * Limite conhecido: conta mensagens existentes no dia; limparChat pode zerar a cota,
 * pois users_own_data FOR ALL permite DELETE. Fechar exige contador sem DELETE
 * (tabela própria ou RPC SECURITY DEFINER), migração que depende do OK do Estevam.
 * Erro na contagem conta como "estourou": sem saber, não gasta cota.
 */
export async function passouDoLimite(client: SupabaseClient, userId: string, now = new Date()): Promise<boolean> {
  const { count, error } = await client
    .from('chat_agente')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('role', 'user')
    .gte('created_at', inicioDoDiaSP(now));
  if (error || count === null) return true;
  return count > limiteDiario();
}
