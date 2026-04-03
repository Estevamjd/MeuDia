'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { clsx } from 'clsx';
import { Sparkles, X, ArrowRight } from 'lucide-react';
import { gerarResumoDiario } from '@meudia/ai';
import type { ContextoUsuario, AIPrioridade } from '@meudia/shared';

interface AgentBannerProps {
  contexto: ContextoUsuario;
  className?: string;
  onDismiss?: () => void;
}

const priorityStyles: Record<AIPrioridade, string> = {
  info: 'border-accent/30 bg-accent/[0.06]',
  aviso: 'border-yellow/30 bg-yellow/[0.06]',
  alerta: 'border-red/30 bg-red/[0.06]',
};

const priorityIcon: Record<AIPrioridade, string> = {
  info: 'from-accent to-accent2',
  aviso: 'from-yellow to-orange',
  alerta: 'from-red to-orange',
};

export function AgentBanner({ contexto, className, onDismiss }: AgentBannerProps) {
  const router = useRouter();

  const resumo = useMemo(() => gerarResumoDiario(contexto), [contexto]);

  return (
    <div
      className={clsx(
        'animate-fadeSlide rounded-card border p-4',
        priorityStyles[resumo.prioridade],
        className,
      )}
    >
      {/* Header */}
      <div className="flex items-start gap-3">
        <div
          className={clsx(
            'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br',
            priorityIcon[resumo.prioridade],
          )}
        >
          <Sparkles size={18} className="text-white" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-accent">Agente IA</p>
            {onDismiss && (
              <button
                onClick={onDismiss}
                className="text-muted/50 transition-colors hover:text-text"
                aria-label="Fechar"
              >
                <X size={14} />
              </button>
            )}
          </div>
          <p className="mt-1 text-sm text-text/90 leading-relaxed">
            {resumo.mensagemPrincipal}
          </p>
        </div>
      </div>

      {/* Ações */}
      {resumo.acoes.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2 pl-12">
          {resumo.acoes.map((acao, i) => (
            <button
              key={i}
              onClick={() => {
                if (acao.acao === 'NAVEGAR' && acao.payload?.rota) {
                  router.push(acao.payload.rota as string);
                }
              }}
              className={clsx(
                'flex items-center gap-1 rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors',
                i === 0
                  ? 'bg-accent/20 text-accent hover:bg-accent/30'
                  : 'text-muted hover:text-text hover:bg-white/5',
              )}
            >
              {acao.label}
              {i === 0 && <ArrowRight size={10} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
