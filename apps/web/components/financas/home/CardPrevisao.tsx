'use client';

import { useId, useState } from 'react';
import { clsx } from 'clsx';
import { CalendarClock, CalendarDays } from 'lucide-react';
import type { Previsao } from '@meudia/shared';
import { formatBRL, formatBRLSinal, formatDiaMes } from '../../../lib/financas-ui';
import { VALOR_OCULTO } from '../../../lib/carteiras-ui';
import { CardDashboard, VALOR_GRANDE } from './CardDashboard';

export interface CardPrevisaoProps {
  tipo: '7dias' | 'fimMes';
  previsao: Previsao;
  escondido: boolean;
}

const TEXTOS = {
  '7dias': { titulo: 'Em 7 dias você terá', id: 'previsao-7dias' },
  fimMes: { titulo: 'No fim do mês sobra', id: 'previsao-fim-mes' },
} as const;

/** Previsão (R10) com "por quê?" que abre a conta em português. */
export function CardPrevisao({ tipo, previsao, escondido }: CardPrevisaoProps) {
  const [aberto, setAberto] = useState(false);
  const painelId = useId();
  const { titulo, id } = TEXTOS[tipo];
  const negativo = previsao.valor < 0;
  const v = (n: number) => (escondido ? VALOR_OCULTO : formatBRL(Math.abs(n)));

  return (
    <CardDashboard
      id={id}
      titulo={titulo}
      icone={tipo === '7dias' ? <CalendarDays size={20} /> : <CalendarClock size={20} />}
      corIcone={negativo ? 'bg-red/[0.14] text-red' : 'bg-green/[0.14] text-green'}
    >
      <p
        data-testid={`${id}-valor`}
        className={clsx('whitespace-nowrap font-semibold leading-tight tabular-nums', negativo && !escondido ? 'text-red' : 'text-text')}
        style={VALOR_GRANDE}
      >
        {escondido ? VALOR_OCULTO : formatBRLSinal(previsao.valor)}
      </p>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[13px] text-muted">até {formatDiaMes(previsao.alvoISO)}</p>
        <button
          type="button"
          onClick={() => setAberto((a) => !a)}
          aria-expanded={aberto}
          aria-controls={painelId}
          aria-label={`por quê? ${titulo}`}
          className="min-h-[44px] px-2 text-sm font-medium text-accent hover:underline"
        >
          por quê?
        </button>
      </div>
      {negativo && !escondido && (
        <p className="text-[13px] text-red">Faltam {formatBRL(-previsao.valor)} para pagar o que vence até lá.</p>
      )}
      {aberto && (
        <div id={painelId} className="space-y-1 rounded-lg bg-card2 p-3 text-[13px]">
          <ul className="space-y-1">
            <li className="flex justify-between gap-3">
              <span className="text-muted">Você tem hoje</span>
              <span className="whitespace-nowrap tabular-nums text-text">{escondido ? VALOR_OCULTO : formatBRLSinal(previsao.saldoHoje)}</span>
            </li>
            {previsao.itens.map((i) => (
              <li key={`${i.tipo}-${i.id}-${i.competencia}`} className="flex justify-between gap-3">
                <span className="min-w-0 break-words text-muted">
                  {i.tipo === 'renda' ? '+ ' : '− '}
                  {i.descricao} ({i.tipo === 'renda' ? 'a receber' : i.vencida ? 'vencida' : 'vence'} {formatDiaMes(i.data)})
                </span>
                <span className={clsx('whitespace-nowrap tabular-nums', i.valor < 0 ? 'text-red' : 'text-green')}>
                  {i.valor < 0 ? '−' : '+'}
                  {v(i.valor)}
                </span>
              </li>
            ))}
            <li className="flex justify-between gap-3 border-t border-border pt-1 font-medium">
              <span className="text-text">= {tipo === '7dias' ? `Em ${formatDiaMes(previsao.alvoISO)}` : 'No fim do mês'}</span>
              <span className="whitespace-nowrap tabular-nums text-text">{escondido ? VALOR_OCULTO : formatBRLSinal(previsao.valor)}</span>
            </li>
          </ul>
          {previsao.itens.length === 0 && <p className="text-muted">Nenhuma conta ou renda prevista até lá.</p>}
          <p className="pt-1 text-muted">Limites do orçamento não entram: aqui só o que já está combinado.</p>
        </div>
      )}
    </CardDashboard>
  );
}
