import type { MensagemChat, MensagemChatInsert } from '@meudia/shared';
import { AppError } from '@meudia/shared';
import { getSupabase } from './supabase';

const TABLE = 'chat_agente';
const COLUMNS = 'id, user_id, role, conteudo, intencao, acoes, created_at';

export async function findByUserId(
  userId: string,
  limit = 50,
): Promise<MensagemChat[]> {
  const { data, error } = await getSupabase()
    .from(TABLE)
    .select(COLUMNS)
    .eq('user_id', userId)
    .order('created_at', { ascending: true })
    .limit(limit);

  if (error) throw new AppError(error.message, 'DB_ERROR');
  return data as unknown as MensagemChat[];
}

export async function findRecentes(
  userId: string,
  limit = 20,
): Promise<MensagemChat[]> {
  const { data, error } = await getSupabase()
    .from(TABLE)
    .select(COLUMNS)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw new AppError(error.message, 'DB_ERROR');
  // Reverter para ordem cronológica
  return (data as unknown as MensagemChat[]).reverse();
}

export async function create(
  userId: string,
  input: MensagemChatInsert,
): Promise<MensagemChat> {
  const { data: created, error } = await getSupabase()
    .from(TABLE)
    .insert({ ...input, user_id: userId })
    .select(COLUMNS)
    .single();

  if (error) throw new AppError(error.message, 'DB_ERROR');
  return created as unknown as MensagemChat;
}

export async function limparHistorico(userId: string): Promise<void> {
  const { error } = await getSupabase()
    .from(TABLE)
    .delete()
    .eq('user_id', userId);

  if (error) throw new AppError(error.message, 'DB_ERROR');
}
