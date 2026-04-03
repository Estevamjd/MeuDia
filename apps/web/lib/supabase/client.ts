'use client';

import { createBrowserClient } from '@supabase/ssr';

let client: ReturnType<typeof createBrowserClient> | null = null;

export function createClient() {
  if (client) return client;

  // Durante SSR/build, retornar null não funciona pois @supabase/ssr valida.
  // Garantimos que só chamamos no browser.
  if (typeof window === 'undefined') {
    // No SSR, criar um proxy que não faz nada — componentes client
    // só usam supabase em useEffect/handlers, nunca no render.
    return null as unknown as ReturnType<typeof createBrowserClient>;
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    console.warn(
      'NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY não configuradas. ' +
        'Configure no .env.local para funcionalidade completa.',
    );
    return null as unknown as ReturnType<typeof createBrowserClient>;
  }

  client = createBrowserClient(url, key);
  return client;
}
