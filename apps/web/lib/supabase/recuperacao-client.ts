'use client';

import { createClient as createSupabaseClient } from '@supabase/supabase-js';

/**
 * Cliente só para pedir o link de "Esqueceu a senha?". Usa o fluxo implícito (sem PKCE): o link do e-mail traz os
 * tokens no `#` e funciona em qualquer navegador/aparelho, não só no que fez o pedido. Não guarda sessão.
 */
export function createRecuperacaoClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (typeof window === 'undefined' || !url || !key) return null;
  return createSupabaseClient(url, key, {
    auth: { flowType: 'implicit', persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
