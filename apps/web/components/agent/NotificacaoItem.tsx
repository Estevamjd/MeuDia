'use client';

import { clsx } from 'clsx';
import { X, AlertTriangle, CheckCircle, Info, AlertCircle } from 'lucide-react';
import type { NotificacaoAgente, TipoNotificacao } from '@meudia/shared';

interface NotificacaoItemProps {
  notificacao: NotificacaoAgente;
  onMarcarLida: (id: string) => void;
  onDispensar: (id: string) => void;
  onAcao: (acao: string, payload?: Record<string, unknown>) => void;
}

const tipoStyles: Record<TipoNotificacao, string> = {
  alerta: 'border-l-red bg-red/[0.06]',
  aviso: 'border-l-yellow bg-yellow/[0.06]',
  sucesso: 'border-l-green bg-green/[0.06]',
  info: 'border-l-accent bg-accent/[0.06]',
};

const tipoIcons: Record<TipoNotificacao, typeof AlertTriangle> = {
  alerta: AlertCircle,
  aviso: AlertTriangle,
  sucesso: CheckCircle,
  info: Info,
};

const tipoIconColor: Record<TipoNotificacao, string> = {
  alerta: 'text-red',
  aviso: 'text-yellow',
  sucesso: 'text-green',
  info: 'text-accent',
};

function formatarTempo(dateStr: string): string {
  const agora = Date.now();
  const data = new Date(dateStr).getTime();
  const diff = agora - data;
  const minutos = Math.floor(diff / 60000);
  if (minutos < 1) return 'agora';
  if (minutos < 60) return `há ${minutos}min`;
  const horas = Math.floor(minutos / 60);
  if (horas < 24) return `há ${horas}h`;
  const dias = Math.floor(horas / 24);
  return `há ${dias}d`;
}

export function NotificacaoItem({
  notificacao,
  onMarcarLida,
  onDispensar,
  onAcao,
}: NotificacaoItemProps) {
  const Icon = tipoIcons[notificacao.tipo];

  return (
    <div
      className={clsx(
        'relative rounded-lg border-l-[3px] p-3 transition-all',
        tipoStyles[notificacao.tipo],
        !notificacao.lida && 'ring-1 ring-white/5',
      )}
      onClick={() => {
        if (!notificacao.lida) onMarcarLida(notificacao.id);
      }}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && !notificacao.lida) onMarcarLida(notificacao.id);
      }}
    >
      {/* Header */}
      <div className="flex items-start gap-2">
        <Icon size={16} className={clsx('mt-0.5 shrink-0', tipoIconColor[notificacao.tipo])} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <p className={clsx('text-sm font-medium truncate', notificacao.lida ? 'text-muted' : 'text-text')}>
              {notificacao.titulo}
            </p>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDispensar(notificacao.id);
              }}
              className="shrink-0 text-muted/50 transition-colors hover:text-text"
              aria-label="Dispensar notificação"
            >
              <X size={14} />
            </button>
          </div>
          <p className={clsx('mt-0.5 text-xs leading-relaxed', notificacao.lida ? 'text-muted/70' : 'text-muted')}>
            {notificacao.mensagem}
          </p>
          <span className="mt-1 block text-[10px] text-muted/50">
            {formatarTempo(notificacao.created_at)}
          </span>
        </div>
      </div>

      {/* Ações */}
      {notificacao.acoes && notificacao.acoes.length > 0 && (
        <div className="mt-2 flex gap-2 pl-6">
          {notificacao.acoes.map((acao, i) => (
            <button
              key={i}
              onClick={(e) => {
                e.stopPropagation();
                onAcao(acao.acao, acao.payload);
              }}
              className={clsx(
                'rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors',
                i === 0
                  ? 'bg-accent/20 text-accent hover:bg-accent/30'
                  : 'text-muted hover:text-text hover:bg-white/5',
              )}
            >
              {acao.label}
            </button>
          ))}
        </div>
      )}

      {/* Indicador não lida */}
      {!notificacao.lida && (
        <div className="absolute right-3 top-3 h-2 w-2 rounded-full bg-accent animate-[pulse_2s_infinite]" />
      )}
    </div>
  );
}
