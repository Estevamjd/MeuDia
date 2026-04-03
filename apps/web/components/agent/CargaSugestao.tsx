'use client';

import { clsx } from 'clsx';
import { Bot, Check, X } from 'lucide-react';
import type { SugestaoCarga } from '@meudia/shared';

interface CargaSugestaoProps {
  sugestao: SugestaoCarga;
  onAceitar: (novaCarga: number) => void;
  onIgnorar: () => void;
  className?: string;
}

export function CargaSugestao({
  sugestao,
  onAceitar,
  onIgnorar,
  className,
}: CargaSugestaoProps) {
  if (sugestao.sugestao === 'MANTER') return null;

  const isAumentar = sugestao.sugestao === 'AUMENTAR';

  return (
    <div
      className={clsx(
        'flex items-center gap-3 rounded-[10px] border p-3 text-xs',
        isAumentar
          ? 'border-accent/20 bg-accent/[0.06]'
          : 'border-yellow/20 bg-yellow/[0.06]',
        className,
      )}
    >
      <Bot
        size={16}
        className={clsx('shrink-0', isAumentar ? 'text-accent' : 'text-yellow')}
      />

      <div className="flex-1 min-w-0">
        <p className="text-text">
          {isAumentar ? 'Aumentar' : 'Reduzir'} para{' '}
          <span className="font-semibold">{sugestao.cargaSugerida}kg</span>
        </p>
        <p className="text-muted mt-0.5">{sugestao.motivo}</p>
      </div>

      <div className="flex gap-1.5 shrink-0">
        <button
          onClick={() => onAceitar(sugestao.cargaSugerida)}
          className="flex h-7 w-7 items-center justify-center rounded-md bg-accent text-white transition-colors hover:bg-accent/80"
          aria-label="Aceitar sugestão"
        >
          <Check size={14} />
        </button>
        <button
          onClick={onIgnorar}
          className="flex h-7 w-7 items-center justify-center rounded-md text-muted transition-colors hover:bg-card2 hover:text-text"
          aria-label="Ignorar sugestão"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}
