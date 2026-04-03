import type { NotificacaoAgente, NotificacaoAgenteInsert } from '@meudia/shared';
import { AppError } from '@meudia/shared';
import { getSupabase } from './supabase';

const TABLE = 'notificacoes_agente';
const COLUMNS =
  'id, user_id, tipo, titulo, mensagem, modulo, lida, dispensada, acoes, created_at';

export async function findByUserId(userId: string): Promise<NotificacaoAgente[]> {
  const { data, error } = await getSupabase()
    .from(TABLE)
    .select(COLUMNS)
    .eq('user_id', userId)
    .eq('dispensada', false)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) throw new AppError(error.message, 'DB_ERROR');
  return data as unknown as NotificacaoAgente[];
}

export async function findNaoLidas(userId: string): Promise<NotificacaoAgente[]> {
  const { data, error } = await getSupabase()
    .from(TABLE)
    .select(COLUMNS)
    .eq('user_id', userId)
    .eq('lida', false)
    .eq('dispensada', false)
    .order('created_at', { ascending: false });

  if (error) throw new AppError(error.message, 'DB_ERROR');
  return data as unknown as NotificacaoAgente[];
}

export async function countNaoLidas(userId: string): Promise<number> {
  const { count, error } = await getSupabase()
    .from(TABLE)
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('lida', false)
    .eq('dispensada', false);

  if (error) throw new AppError(error.message, 'DB_ERROR');
  return count ?? 0;
}

export async function create(
  userId: string,
  input: NotificacaoAgenteInsert,
): Promise<NotificacaoAgente> {
  const { data: created, error } = await getSupabase()
    .from(TABLE)
    .insert({ ...input, user_id: userId })
    .select(COLUMNS)
    .single();

  if (error) throw new AppError(error.message, 'DB_ERROR');
  return created as unknown as NotificacaoAgente;
}

export async function marcarLida(notificacaoId: string): Promise<void> {
  const { error } = await getSupabase()
    .from(TABLE)
    .update({ lida: true })
    .eq('id', notificacaoId);

  if (error) throw new AppError(error.message, 'DB_ERROR');
}

export async function marcarTodasLidas(userId: string): Promise<void> {
  const { error } = await getSupabase()
    .from(TABLE)
    .update({ lida: true })
    .eq('user_id', userId)
    .eq('lida', false);

  if (error) throw new AppError(error.message, 'DB_ERROR');
}

export async function dispensar(notificacaoId: string): Promise<void> {
  const { error } = await getSupabase()
    .from(TABLE)
    .update({ dispensada: true })
    .eq('id', notificacaoId);

  if (error) throw new AppError(error.message, 'DB_ERROR');
}
