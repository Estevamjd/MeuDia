import type { PreferenciasAgente, PreferenciasAgenteUpdate } from '@meudia/shared';
import { AppError } from '@meudia/shared';
import { getSupabase } from './supabase';

const TABLE = 'preferencias_agente';
const COLUMNS =
  'user_id, notif_faltou_treino, notif_habito_pendente, horario_verificacao, timer_descanso_auto, sugestao_carga_auto, chat_ativo, created_at';

export async function findByUserId(userId: string): Promise<PreferenciasAgente | null> {
  const { data, error } = await getSupabase()
    .from(TABLE)
    .select(COLUMNS)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw new AppError(error.message, 'DB_ERROR');
  return data as unknown as PreferenciasAgente | null;
}

export async function upsert(
  userId: string,
  input: PreferenciasAgenteUpdate,
): Promise<PreferenciasAgente> {
  const { data: result, error } = await getSupabase()
    .from(TABLE)
    .upsert({ ...input, user_id: userId })
    .select(COLUMNS)
    .single();

  if (error) throw new AppError(error.message, 'DB_ERROR');
  return result as unknown as PreferenciasAgente;
}
