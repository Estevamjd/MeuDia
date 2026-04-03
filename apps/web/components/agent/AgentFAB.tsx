'use client';

import { Bot } from 'lucide-react';
import { useContarNaoLidas } from '../../hooks/useAgente';

interface AgentFABProps {
  onClick: () => void;
}

export function AgentFAB({ onClick }: AgentFABProps) {
  const { data: count } = useContarNaoLidas();
  const alertas = count ?? 0;

  return (
    <button
      onClick={onClick}
      className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-accent to-accent2 text-white shadow-[0_4px_24px_rgba(124,106,255,0.4)] transition-all duration-200 hover:scale-[1.08] hover:shadow-[0_6px_32px_rgba(124,106,255,0.6)] active:scale-95"
      aria-label="Abrir agente IA"
    >
      <Bot size={24} />

      {alertas > 0 && (
        <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-red text-[10px] font-bold text-white animate-[pulse_2s_infinite]">
          {alertas > 9 ? '9+' : alertas}
        </span>
      )}
    </button>
  );
}
