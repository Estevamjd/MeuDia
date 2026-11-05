import type { PreferenciasAgente, PreferenciasAgenteUpdate } from '@meudia/shared';
import { AppError } from '@meudia/shared';
import { erroDb, schemaDesatualizado } from './erros-db';
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

/**
 * Lembrete de treino (`notif_treino`, migration 008, DEFAULT false). Sem linha = desligado.
 * Devolve null quando a coluna ainda não existe (008 não aplicada): a tela mostra o interruptor indisponível.
 */
export async function findLembreteTreino(userId: string): Promise<boolean | null> {
  const { data, error } = await getSupabase()
    .from(TABLE)
    .select('notif_treino')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    if (schemaDesatualizado(error)) return null;
    throw new AppError(error.message, 'DB_ERROR');
  }
  return (data as { notif_treino: boolean | null } | null)?.notif_treino === true;
}

/** Grava só `notif_treino`; as outras preferências ficam como estão (ou com o DEFAULT do banco). */
export async function salvarLembreteTreino(userId: string, ligado: boolean): Promise<boolean> {
  const { data, error } = await getSupabase()
    .from(TABLE)
    .upsert({ user_id: userId, notif_treino: ligado }, { onConflict: 'user_id' })
    .select('notif_treino')
    .single();

  if (error) erroDb(error);
  return (data as { notif_treino: boolean | null }).notif_treino === true;
}
