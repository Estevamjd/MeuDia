'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
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

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const supabaseRef = useRef(initSupabase());

  useEffect(() => {
    const supabase = supabaseRef.current;
    if (!supabase) {
      setLoading(false);
      return;
    }

    const getUser = async () => {
      try {
        const { data: { user: currentUser } } = await supabase.auth.getUser();
        setUser(currentUser);
      } catch (err) {
        console.warn('Erro ao obter usuário:', err);
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    void getUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = useCallback(async () => {
    const supabase = supabaseRef.current;
    if (supabase) {
      await supabase.auth.signOut();
    }
    router.push('/login');
  }, [router]);

  return { user, loading, signOut };
}
