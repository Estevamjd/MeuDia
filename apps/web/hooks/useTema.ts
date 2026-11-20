'use client';

import { useCallback, useEffect, useSyncExternalStore } from 'react';
import { CHAVE_TEMA, TEMA_PADRAO, lerPreferencia, pintarModo, resolverModo, type ModoTema, type PreferenciaTema } from '../lib/tema';
import { CHAVE_COR, COR_PADRAO, lerCor, pintarCor, type CorApp } from '../lib/cores-app';
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
    if (e.key === CHAVE_COR) {
      // Outra aba gravou: o aparelho passa a valer (inclusive sobre a cor em memória desta aba).
      corMemoria = lerCorLocal();
      pintarCor(corAtual());
      f();
    }
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

function lerCorLocal(): CorApp | null {
  try {
    return lerCor(localStorage.getItem(CHAVE_COR));
  } catch {
    return null;
  }
}

/**
 * Cor desta aba em memória: vale mesmo se o localStorage recusar a gravação (Safari privado, cota, storage
 * bloqueado), para o snapshot não voltar ao Ciano com o <html> já pintado de outra cor.
 */
let corMemoria: CorApp | null = null;

/**
 * Última cor escolhida nesta aba (e de qual conta). Cada escolha manda um updateUser; a resposta (USER_UPDATED)
 * de uma escolha anterior pode chegar depois, inclusive depois da resposta da escolha mais nova. Valor da conta
 * diferente da última escolha da mesma conta é eco velho e não repinta.
 */
let ultimaEscolha: { cor: CorApp; userId: string | null } | null = null;

function corAtual(): CorApp {
  return corMemoria ?? lerCorLocal() ?? COR_PADRAO;
}

/** Só para testes: zera o estado do módulo. */
export function redefinirCorAppParaTeste(): void {
  corMemoria = null;
  ultimaEscolha = null;
}

/** Aplica a cor do app e grava no aparelho. */
function guardarCorLocal(cor: CorApp) {
  corMemoria = cor;
  try {
    localStorage.setItem(CHAVE_COR, cor);
  } catch {
    /* sem storage: vale só nesta visita */
  }
  pintarCor(cor);
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

export interface UseCorApp {
  cor: CorApp;
  escolher: (cor: CorApp) => void;
}

/** Cor do app (accent): mesma regra do tema, aparelho + conta (user_metadata.cor_app). */
export function useCorApp(): UseCorApp {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const cor = useSyncExternalStore(assinar, corAtual, () => COR_PADRAO);
  const escolher = useCallback((c: CorApp) => {
    ultimaEscolha = { cor: c, userId };
    guardarCorLocal(c);
    const sb = createClient();
    void sb?.auth.updateUser({ data: { cor_app: c } }).catch(() => undefined);
  }, [userId]);
  return { cor, escolher };
}

/** Ao entrar: se a conta tem tema/cor salvos diferentes do aparelho, a conta vence (escolha feita em outro aparelho). */
export function useSincronizarTema(): void {
  const { user } = useAuth();
  const daConta = lerPreferencia(user?.user_metadata?.tema);
  const corDaConta = lerCor(user?.user_metadata?.cor_app);
  const contaId = user?.id ?? null;
  useEffect(() => {
    if (daConta && daConta !== lerLocal()) guardarLocal(daConta);
  }, [daConta]);
  useEffect(() => {
    if (!corDaConta) return;
    // Eco de uma escolha anterior desta aba (resposta atrasada): a escolha mais nova vence.
    if (ultimaEscolha && ultimaEscolha.userId === contaId && corDaConta !== ultimaEscolha.cor) return;
    if (corDaConta !== corAtual()) guardarCorLocal(corDaConta);
  }, [corDaConta, contaId]);
}
