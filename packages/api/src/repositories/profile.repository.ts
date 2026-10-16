import type { Profile, ProfileUpdate } from '@meudia/shared';
import { AppError } from '@meudia/shared';
import { getSupabase } from './supabase';

/** `null` quando a linha não existe (ex.: trigger de criação falhou) — tratado como onboarding pendente. */
export async function findById(userId: string): Promise<Profile | null> {
  const { data, error } = await getSupabase()
    .from('profiles')
    .select('id, nome, email, avatar_url, peso_atual, altura, meta_peso, meta_calorias, meta_agua, objetivo, onboarding_feito, created_at')
    .eq('id', userId)
    .maybeSingle();

  if (error) throw new AppError(error.message, 'DB_ERROR');
  return (data as unknown as Profile | null) ?? null;
}

export async function update(userId: string, data: ProfileUpdate): Promise<Profile> {
  const { data: updated, error } = await getSupabase()
    .from('profiles')
    .update(data)
    .eq('id', userId)
    .select('id, nome, email, avatar_url, peso_atual, altura, meta_peso, meta_calorias, meta_agua, objetivo, onboarding_feito, created_at')
    .single();

  if (error) throw new AppError(error.message, 'DB_ERROR');
  return updated as unknown as Profile;
}
