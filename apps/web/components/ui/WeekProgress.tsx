'use client';

import { clsx } from 'clsx';
import { DIAS_SEMANA_CURTO } from '@meudia/shared';

type DayStatus = 'done' | 'today' | 'pending' | 'rest' | 'missed';

interface WeekProgressProps {
  days: DayStatus[];
  className?: string;
}

const statusConfig: Record<DayStatus, { bg: string; icon: string; label: string }> = {
  done: { bg: 'bg-green text-bg', icon: '✓', label: 'Concluído' },
  today: { bg: 'bg-orange text-bg', icon: '🏋️', label: 'Hoje' },
  pending: { bg: 'bg-card2 text-muted', icon: '○', label: 'Pendente' },
  rest: { bg: 'bg-card2 text-muted/50', icon: '—', label: 'Descanso' },
  missed: { bg: 'bg-red/20 text-red', icon: '✕', label: 'Perdido' },
};

export function WeekProgress({ days, className }: WeekProgressProps) {
  return (
    <div className={clsx('flex items-center justify-between gap-2', className)}>
      {days.map((status, i) => {
        const config = statusConfig[status];
        return (
          <div key={i} className="flex flex-col items-center gap-1.5">
            <span className="text-[10px] text-muted">{DIAS_SEMANA_CURTO[i]}</span>
            <div
              className={clsx(
                'flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold transition-all',
                config.bg,
                status === 'today' && 'glow-orange',
              )}
              title={config.label}
              aria-label={`${DIAS_SEMANA_CURTO[i]}: ${config.label}`}
            >
              {config.icon}
            </div>
          </div>
        );
      })}
    </div>
  );
}
