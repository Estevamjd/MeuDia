'use client';

import { useCallback, useEffect, useSyncExternalStore } from 'react';
import { CHAVE_TEMA, TEMA_PADRAO, lerPreferencia, pintarModo, resolverModo, type ModoTema, type PreferenciaTema } from '../lib/tema';
import { createClient } from '../lib/supabase/client';
import { useAuth } from './useAuth';

const ouvintes = new Set<() => void>();
const avisar = () => ouvintes.forEach((f) => f());
const CONSULTA_ESCURO = '(prefers-color-scheme: dark)';

function lerLocal(): PreferenciaTema | null {
  try {
    return lerPreferencia(localStorage.getItem(CHAVE_TEMA));
  } catch {
    return null;
  }
}

function sistemaEscuro(): boolean {
  return typeof window.matchMedia === 'function' ? window.matchMedia(CONSULTA_ESCURO).matches : true;
}

function assinar(f: () => void) {
  ouvintes.add(f);
  const mq = typeof window.matchMedia === 'function' ? window.matchMedia(CONSULTA_ESCURO) : null;
  const aoMudarSistema = () => {
    if ((lerLocal() ?? TEMA_PADRAO) === 'sistema') pintarModo(resolverModo('sistema', sistemaEscuro()));
    f();
  };
  const aoMudarStorage = (e: StorageEvent) => {
    if (e.key !== CHAVE_TEMA) return;
    pintarModo(resolverModo(lerLocal() ?? TEMA_PADRAO, sistemaEscuro()));
    f();
  };
  mq?.addEventListener('change', aoMudarSistema);
  window.addEventListener('storage', aoMudarStorage);
  return () => {
    ouvintes.delete(f);
    mq?.removeEventListener('change', aoMudarSistema);
    window.removeEventListener('storage', aoMudarStorage);
  };
}

/** Aplica e grava no aparelho. */
function guardarLocal(preferencia: PreferenciaTema) {
  try {
    localStorage.setItem(CHAVE_TEMA, preferencia);
  } catch {
    /* sem storage: vale só nesta visita */
  }
  pintarModo(resolverModo(preferencia, sistemaEscuro()));
  avisar();
}

export interface UseTema {
  preferencia: PreferenciaTema;
  modo: ModoTema;
  escolher: (preferencia: PreferenciaTema) => void;
}

export function useTema(): UseTema {
  const preferencia = useSyncExternalStore(assinar, () => lerLocal() ?? TEMA_PADRAO, () => TEMA_PADRAO);
  const escuro = useSyncExternalStore(assinar, sistemaEscuro, () => true);
  const escolher = useCallback((p: PreferenciaTema) => {
    guardarLocal(p);
    // Na conta também, para seguir a pessoa em outro aparelho. Falhar aqui não desfaz a escolha local.
    const sb = createClient();
    void sb?.auth.updateUser({ data: { tema: p } }).catch(() => undefined);
  }, []);
  return { preferencia, modo: resolverModo(preferencia, escuro), escolher };
}

/** Ao entrar: se a conta tem um tema salvo diferente do aparelho, a conta vence (escolha feita em outro aparelho). */
export function useSincronizarTema(): void {
  const { user } = useAuth();
  const daConta = lerPreferencia(user?.user_metadata?.tema);
  useEffect(() => {
    if (daConta && daConta !== lerLocal()) guardarLocal(daConta);
  }, [daConta]);
}
