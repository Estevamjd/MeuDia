'use client';

import { useEffect, useState } from 'react';
import { Wifi, WifiOff, RefreshCw, CheckCircle, AlertCircle } from 'lucide-react';

interface OfflineIndicatorProps {
  isOnline: boolean;
  isSyncing: boolean;
  pendingCount: number;
  lastSyncError: string | null;
  onForceSync?: () => void;
}

export function OfflineIndicator({
  isOnline,
  isSyncing,
  pendingCount,
  lastSyncError,
  onForceSync,
}: OfflineIndicatorProps) {
  const [showSyncSuccess, setShowSyncSuccess] = useState(false);
  const [wasOffline, setWasOffline] = useState(false);

  // Mostra "Sincronizado!" brevemente quando volta online
  useEffect(() => {
    if (!isOnline) {
      setWasOffline(true);
    } else if (wasOffline && !isSyncing && pendingCount === 0) {
      setShowSyncSuccess(true);
      const timer = setTimeout(() => {
        setShowSyncSuccess(false);
        setWasOffline(false);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [isOnline, isSyncing, pendingCount, wasOffline]);

  // Não mostra nada se está online, sem pendências e sem mensagem de sucesso
  if (isOnline && pendingCount === 0 && !showSyncSuccess && !lastSyncError && !isSyncing) {
    return null;
  }

  return (
    <div className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2 animate-in fade-in slide-in-from-bottom-4">
      {/* Offline */}
      {!isOnline && (
        <div className="flex items-center gap-2 rounded-xl bg-amber-500/90 px-4 py-2.5 text-sm font-medium text-white shadow-lg backdrop-blur-sm">
          <WifiOff className="h-4 w-4 flex-shrink-0" />
          <span>Sem conexão</span>
          {pendingCount > 0 && (
            <span className="ml-1 rounded-full bg-white/20 px-2 py-0.5 text-xs">
              {pendingCount} pendente{pendingCount > 1 ? 's' : ''}
            </span>
          )}
        </div>
      )}

      {/* Sincronizando */}
      {isOnline && isSyncing && (
        <div className="flex items-center gap-2 rounded-xl bg-primary/90 px-4 py-2.5 text-sm font-medium text-white shadow-lg backdrop-blur-sm">
          <RefreshCw className="h-4 w-4 flex-shrink-0 animate-spin" />
          <span>Sincronizando...</span>
          {pendingCount > 0 && (
            <span className="ml-1 rounded-full bg-white/20 px-2 py-0.5 text-xs">
              {pendingCount}
            </span>
          )}
        </div>
      )}

      {/* Sucesso após sync */}
      {showSyncSuccess && !isSyncing && (
        <div className="flex items-center gap-2 rounded-xl bg-green-500/90 px-4 py-2.5 text-sm font-medium text-white shadow-lg backdrop-blur-sm">
          <CheckCircle className="h-4 w-4 flex-shrink-0" />
          <span>Sincronizado!</span>
        </div>
      )}

      {/* Erro de sync */}
      {lastSyncError && !isSyncing && (
        <div className="flex items-center gap-2 rounded-xl bg-red-500/90 px-4 py-2.5 text-sm font-medium text-white shadow-lg backdrop-blur-sm">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          <span>{lastSyncError}</span>
          {onForceSync && (
            <button
              onClick={onForceSync}
              className="ml-1 rounded-lg bg-white/20 px-2 py-0.5 text-xs hover:bg-white/30 transition-colors"
            >
              Tentar novamente
            </button>
          )}
        </div>
      )}

      {/* Online mas com pendências (ex: handler não definido ainda) */}
      {isOnline && !isSyncing && !showSyncSuccess && !lastSyncError && pendingCount > 0 && (
        <div className="flex items-center gap-2 rounded-xl bg-muted/90 px-4 py-2.5 text-sm font-medium text-text shadow-lg backdrop-blur-sm">
          <Wifi className="h-4 w-4 flex-shrink-0" />
          <span>{pendingCount} ação(ões) pendente(s)</span>
          {onForceSync && (
            <button
              onClick={onForceSync}
              className="ml-1 rounded-lg bg-primary/20 px-2 py-0.5 text-xs text-primary hover:bg-primary/30 transition-colors"
            >
              Sincronizar
            </button>
          )}
        </div>
      )}
    </div>
  );
}
