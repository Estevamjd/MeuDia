'use client';

import { useSyncExternalStore } from 'react';

/** Chave da antiga fila offline falsa (removida): resto que ainda pode estar no aparelho. */
export const CHAVE_FILA_OFFLINE_LEGADA = 'meudia-offline-queue';

function assinar(aviso: () => void) {
  window.addEventListener('online', aviso);
  window.addEventListener('offline', aviso);
  return () => {
    window.removeEventListener('online', aviso);
    window.removeEventListener('offline', aviso);
  };
}

/**
 * Só leitura do `navigator.onLine` (eventos online/offline). Não guarda nem repete gravações:
 * sem rede a requisição falha e a tela mostra o erro de sempre.
 */
export function useOnline(): boolean {
  return useSyncExternalStore(
    assinar,
    () => navigator.onLine,
    () => true,
  );
}

/** Apaga a fila legada uma vez (ninguém mais lê essa chave; repetir ações velhas seria inseguro). */
export function limparFilaOfflineLegada(armazenamento?: Pick<Storage, 'removeItem'>) {
  try {
    // O getter de `localStorage` pode lançar (SecurityError com storage bloqueado): lido dentro do try.
    (armazenamento ?? globalThis.localStorage)?.removeItem(CHAVE_FILA_OFFLINE_LEGADA);
  } catch {
    // Storage bloqueado (modo privado): nada a limpar.
  }
}
