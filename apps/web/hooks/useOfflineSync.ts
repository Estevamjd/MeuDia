'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { peekQueue, dequeue, enqueue, getQueueSize } from '../lib/offline-queue';

type ActionHandler = (action: string, payload: unknown) => Promise<void>;

/**
 * Hook para sincronização offline.
 *
 * - Monitora status de conexão (online/offline)
 * - Quando volta online, processa a fila de ações pendentes
 * - Fornece `enqueueAction` para adicionar ações à fila quando offline
 * - Invalida queries do React Query após sincronização
 */
export function useOfflineSync(handler?: ActionHandler) {
  const [isOnline, setIsOnline] = useState(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [isSyncing, setIsSyncing] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [lastSyncError, setLastSyncError] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const handlerRef = useRef(handler);
  const syncingRef = useRef(false);

  // Mantém ref atualizada sem causar re-renders
  useEffect(() => {
    handlerRef.current = handler;
  }, [handler]);

  // Atualiza contagem de pendentes
  const refreshPendingCount = useCallback(() => {
    setPendingCount(getQueueSize());
  }, []);

  // Processa a fila de ações offline
  const processQueue = useCallback(async () => {
    if (syncingRef.current || !handlerRef.current) return;

    const queue = peekQueue();
    if (queue.length === 0) return;

    syncingRef.current = true;
    setIsSyncing(true);
    setLastSyncError(null);

    let processedCount = 0;

    for (const item of queue) {
      try {
        await handlerRef.current(item.action, item.payload);
        dequeue(item.id);
        processedCount++;
      } catch (error) {
        console.error(`[OfflineSync] Falha ao processar ação "${item.action}":`, error);
        setLastSyncError(
          `Falha ao sincronizar ${queue.length - processedCount} ação(ões)`
        );
        // Para no primeiro erro para não pular ações dependentes
        break;
      }
    }

    // Invalida todas as queries para refletir dados sincronizados
    if (processedCount > 0) {
      await queryClient.invalidateQueries();
    }

    syncingRef.current = false;
    setIsSyncing(false);
    refreshPendingCount();
  }, [queryClient, refreshPendingCount]);

  // Listeners de online/offline
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      // Pequeno delay para garantir que a conexão estabilizou
      setTimeout(() => {
        void processQueue();
      }, 1000);
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Verificação inicial
    refreshPendingCount();

    // Se já está online e tem itens na fila, processa
    if (navigator.onLine && getQueueSize() > 0) {
      void processQueue();
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [processQueue, refreshPendingCount]);

  // Adiciona ação à fila (quando offline) ou executa direto (quando online)
  const enqueueAction = useCallback(
    async (action: string, payload: unknown) => {
      if (!navigator.onLine) {
        enqueue(action, payload);
        refreshPendingCount();
        return;
      }

      // Se online, tenta executar direto
      if (handlerRef.current) {
        try {
          await handlerRef.current(action, payload);
        } catch {
          // Se falhou online, coloca na fila
          enqueue(action, payload);
          refreshPendingCount();
        }
      }
    },
    [refreshPendingCount]
  );

  // Força sincronização manual
  const forceSync = useCallback(() => {
    if (navigator.onLine) {
      void processQueue();
    }
  }, [processQueue]);

  return {
    isOnline,
    isSyncing,
    pendingCount,
    lastSyncError,
    enqueueAction,
    forceSync,
  };
}
