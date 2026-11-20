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
 * Consome a cota atômica da 016, independente do histórico apagável do chat.
 * Antes da migration, apenas RPC ausente permite a contagem legada (a rota já
 * gravou a mensagem atual). Qualquer outro erro falha fechado.
 */
export async function passouDoLimite(client: SupabaseClient, userId: string, now = new Date()): Promise<boolean> {
  const limite = limiteDiario();
  try {
    const { data, error, status } = await client.rpc('ia_consumir_cota', { p_limite: limite });
    if (!error) return !data || typeof data !== 'object' || data.permitido !== true;
    if (error.code !== 'PGRST202' && error.code !== '42883' && status !== 404) return true;

    const { count, error: erroContagem } = await client
      .from('chat_agente')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('role', 'user')
      .gte('created_at', inicioDoDiaSP(now));
    if (erroContagem || count === null) return true;
    return count > limite;
  } catch {
    return true;
  }
}
