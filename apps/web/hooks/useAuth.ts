'use client';

import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react';
import { useRouter } from 'next/navigation';
import type { User, SupabaseClient } from '@supabase/supabase-js';
import { setSupabaseClient } from '@meudia/api';
import { createClient } from '../lib/supabase/client';

function initSupabase(): SupabaseClient | null {
  const sb = createClient();
  // Injeta o mesmo client no packages/api para compartilhar sessão de auth
  if (sb) setSupabaseClient(sb);
  return sb;
}

interface EstadoAuth {
  user: User | null;
  loading: boolean;
}

/**
 * Estado de auth único para a aba inteira: um só `getUser()` (rede) e uma só inscrição em `onAuthStateChange`,
 * por mais componentes que usem `useAuth`. Antes cada um chamava `getUser()` ao montar e o supabase-js punha as
 * chamadas em fila: ~20 idas ao Supabase em série a cada troca de aba (hooks/__tests__/useAuth.test.tsx).
 */
const CARREGANDO: EstadoAuth = { user: null, loading: true };
let estado: EstadoAuth = CARREGANDO;
let iniciado = false;
const ouvintes = new Set<() => void>();

function publicar(novo: EstadoAuth) {
  estado = novo;
  for (const ouvinte of ouvintes) ouvinte();
}

function iniciarAuth(supabase: SupabaseClient | null) {
  if (iniciado) return;
  iniciado = true;
  if (!supabase) {
    publicar({ user: null, loading: false });
    return;
  }
  // Um evento real de auth (logout, login de outra conta, inclusive vindo de outra aba) que chegue com o
  // getUser() ainda pendente vale mais que a resposta dele; INITIAL_SESSION (sessão local) não descarta a
  // verificação do servidor.
  let eventosDepois = 0;
  supabase.auth.getUser().then(
    ({ data: { user } }) => {
      if (eventosDepois === 0) publicar({ user, loading: false });
    },
    (err: unknown) => {
      console.warn('Erro ao obter usuário:', err);
      if (eventosDepois === 0) publicar({ user: null, loading: false });
    },
  );
  // Sem unsubscribe: vive enquanto a aba vive, como o client do Supabase.
  supabase.auth.onAuthStateChange((event, session) => {
    if (event !== 'INITIAL_SESSION') eventosDepois += 1;
    publicar({ user: session?.user ?? null, loading: false });
  });
}

function inscrever(ouvinte: () => void) {
  ouvintes.add(ouvinte);
  return () => ouvintes.delete(ouvinte);
}

export function useAuth() {
  const { user, loading } = useSyncExternalStore(inscrever, () => estado, () => CARREGANDO);
  const router = useRouter();
  const supabaseRef = useRef<SupabaseClient | null>(null);
  supabaseRef.current ??= initSupabase();

  useEffect(() => {
    iniciarAuth(supabaseRef.current);
  }, []);

  const signOut = useCallback(async () => {
    const supabase = supabaseRef.current;
    if (supabase) {
      try {
        if ('serviceWorker' in navigator) {
          const reg = await navigator.serviceWorker.getRegistration();
          const sub = await reg?.pushManager?.getSubscription();
          if (sub) {
            await fetch('/api/push/subscribe', {
              method: 'DELETE',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ endpoint: sub.endpoint }),
            });
            await sub.unsubscribe();
          }
        }
      } catch { /* Falhas no push não impedem o logout. */ }
      await supabase.auth.signOut();
    }
    router.push('/login');
  }, [router]);

  return { user, loading, signOut };
}
