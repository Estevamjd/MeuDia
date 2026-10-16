import { paginas } from './cron-pagination';
import type { PushSubscriptionRow } from '@meudia/shared';
import { AppError } from '@meudia/shared';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabase } from './supabase';

const COLUMNS = 'id, user_id, endpoint, p256dh, auth, user_agent, created_at, last_used_at';
type Subscription = { endpoint: string; keys: { p256dh: string; auth: string }; user_agent?: string };

export async function upsertByEndpoint(userId: string, sub: Subscription, client = getSupabase()): Promise<PushSubscriptionRow> {
  const { data, error } = await client.from('push_subscriptions').upsert({
    user_id: userId, endpoint: sub.endpoint, p256dh: sub.keys.p256dh, auth: sub.keys.auth, user_agent: sub.user_agent ?? null,
  }, { onConflict: 'user_id,endpoint' }).select(COLUMNS).single();
  if (error) throw new AppError(error.code === '23505' ? 'Inscrição duplicada' : 'Falha na inscrição push', error.code === '23505' ? 'CONFLICT' : 'DB_ERROR', error.code === '23505' ? 409 : 500);
  return data as unknown as PushSubscriptionRow;
}

export async function removeByEndpoint(userId: string, endpoint: string, client = getSupabase()): Promise<void> {
  const { error } = await client.from('push_subscriptions').delete().eq('user_id', userId).eq('endpoint', endpoint);
  if (error) throw new AppError(error.code === '23505' ? 'Inscrição duplicada' : 'Falha na inscrição push', error.code === '23505' ? 'CONFLICT' : 'DB_ERROR', error.code === '23505' ? 409 : 500);
}

export async function inscricoesDoUsuarioParaCron(client: SupabaseClient, userId: string): Promise<PushSubscriptionRow[]> {
  return await paginas(() => client.from('push_subscriptions').select(COLUMNS).eq('user_id', userId).order('id')) as unknown as PushSubscriptionRow[];
}

export async function removerInscricaoParaCron(client: SupabaseClient, id: string): Promise<void> {
  const { error } = await client.from('push_subscriptions').delete().eq('id', id);
  if (error) throw new AppError(error.code === '23505' ? 'Inscrição duplicada' : 'Falha na inscrição push', error.code === '23505' ? 'CONFLICT' : 'DB_ERROR', error.code === '23505' ? 409 : 500);
}
