import { createClient, SupabaseClient } from '@supabase/supabase-js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let client: SupabaseClient<any> | null = null;

/**
 * Injeta um Supabase client externo (ex: createBrowserClient do @supabase/ssr).
 * Deve ser chamado uma vez na inicialização do app (ex: provider de auth).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function setSupabaseClient(externalClient: SupabaseClient<any>) {
  client = externalClient;
}

export function getSupabase() {
  if (client) return client;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error('Supabase URL e Anon Key são obrigatórias');
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client = createClient<any>(url, key);
  return client;
}
