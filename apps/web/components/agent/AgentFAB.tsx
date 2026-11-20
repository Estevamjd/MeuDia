'use client';

import { useSyncExternalStore } from 'react';
import { Bot } from 'lucide-react';
import { clsx } from 'clsx';
import { useContarNaoLidas } from '../../hooks/useAgente';

interface AgentFABProps {
  onClick: () => void;
  className?: string;
}

// Mesmo corte do `md:` do Tailwind: o FAB só aparece daí para cima (`hidden md:flex`).
const CONSULTA_MD = '(min-width: 768px)';

function assinarMd(avisar: () => void) {
  if (typeof window.matchMedia !== 'function') return () => {};
  const mql = window.matchMedia(CONSULTA_MD);
  mql.addEventListener?.('change', avisar);
  return () => mql.removeEventListener?.('change', avisar);
}

const lerMd = () => typeof window.matchMedia === 'function' && window.matchMedia(CONSULTA_MD).matches;

export function AgentFAB({ onClick, className }: AgentFABProps) {
  const telaMd = useSyncExternalStore(assinarMd, lerMd, () => false);
  // Sem polling e só consulta com o FAB visível (desktop), nos dois modos.
  const { data: count } = useContarNaoLidas({ enabled: telaMd, poll: false });
  const alertas = count ?? 0;

  return (
    <button
      onClick={onClick}
      className={clsx(
        'fixed bottom-6 right-6 z-nav flex h-14 w-14 items-center justify-center rounded-full bg-accent text-accent-fg shadow-[0_4px_24px_rgb(var(--c-brilho)/0.4)] transition-all duration-200 hover:scale-[1.08] hover:shadow-[0_6px_32px_rgb(var(--c-brilho)/0.6)] active:scale-95',
        className,
      )}
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
