'use client';

import { useEffect } from 'react';
import { WifiOff } from 'lucide-react';
import { limparFilaOfflineLegada, useOnline } from '../../hooks/useOnline';

/**
 * Aviso só de leitura: "Sem internet" enquanto o aparelho está offline. Não há fila offline;
 * gravar sem rede falha e mostra o erro da própria tela.
 */
export function OfflineIndicator() {
  const online = useOnline();
  useEffect(() => limparFilaOfflineLegada(), []);
  if (online) return null;
  return (
    <div
      role="status"
      className="fixed bottom-4 left-1/2 z-toast -translate-x-1/2 animate-in fade-in slide-in-from-bottom-4"
    >
      <div className="flex items-center gap-2 rounded-xl bg-amber-500/90 px-4 py-2.5 text-sm font-medium text-white shadow-lg backdrop-blur-sm">
        <WifiOff className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
        <span>Sem internet: nada é salvo até a conexão voltar.</span>
      </div>
    </div>
  );
}
