import type { PushSubscriptionRow } from '@meudia/shared';
import { AppError } from '@meudia/shared';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabase } from './supabase';

const COLUMNS = 'id, user_id, endpoint, p256dh, auth, user_agent, created_at, last_used_at';
type Subscription = { endpoint: string; keys: { p256dh: string; auth: string }; user_agent?: string };

export async function upsertByEndpoint(userId: string, sub: Subscription): Promise<PushSubscriptionRow> {
  const { data, error } = await getSupabase().from('push_subscriptions').upsert({
    user_id: userId, endpoint: sub.endpoint, p256dh: sub.keys.p256dh, auth: sub.keys.auth, user_agent: sub.user_agent ?? null,
  }, { onConflict: 'endpoint' }).eq('user_id', userId).select(COLUMNS).single();
  if (error) throw new AppError(error.message, 'DB_ERROR');
  return data as unknown as PushSubscriptionRow;
}

export async function removeByEndpoint(userId: string, endpoint: string): Promise<void> {
  const { error } = await getSupabase().from('push_subscriptions').delete().eq('user_id', userId).eq('endpoint', endpoint);
  if (error) throw new AppError(error.message, 'DB_ERROR');
}

export async function inscricoesDoUsuarioParaCron(client: SupabaseClient, userId: string): Promise<PushSubscriptionRow[]> {
  const { data, error } = await client.from('push_subscriptions').select(COLUMNS).eq('user_id', userId);
  if (error) throw new AppError(error.message, 'DB_ERROR');
  return data as unknown as PushSubscriptionRow[];
}

export async function removerInscricaoParaCron(client: SupabaseClient, id: string): Promise<void> {
  const { error } = await client.from('push_subscriptions').delete().eq('id', id);
  if (error) throw new AppError(error.message, 'DB_ERROR');
}
