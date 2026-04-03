import { clsx } from 'clsx';
import { Sparkles, X } from 'lucide-react';
import type { AIPrioridade } from '@meudia/shared';

interface AIBannerProps {
  message: string;
  priority?: AIPrioridade;
  onDismiss?: () => void;
  className?: string;
}

const priorityStyles: Record<AIPrioridade, string> = {
  info: 'border-accent/30 bg-accent/[0.08]',
  aviso: 'border-yellow/30 bg-yellow/[0.08]',
  alerta: 'border-red/30 bg-red/[0.08]',
};

const priorityIcon: Record<AIPrioridade, string> = {
  info: 'text-accent',
  aviso: 'text-yellow',
  alerta: 'text-red',
};

export function AIBanner({ message, priority = 'info', onDismiss, className }: AIBannerProps) {
  return (
    <div
      className={clsx(
        'animate-fadeSlide flex items-start gap-3 rounded-card border p-4',
        priorityStyles[priority],
        className,
      )}
      role={priority === 'alerta' ? 'alert' : 'status'}
    >
      <Sparkles size={18} className={clsx('mt-0.5 shrink-0', priorityIcon[priority])} />
      <p className="flex-1 text-sm text-text">{message}</p>
      {onDismiss && (
        <button
          onClick={onDismiss}
          className="shrink-0 text-muted transition-colors hover:text-text"
          aria-label="Fechar dica"
        >
          <X size={16} />
        </button>
      )}
    </div>
  );
}
