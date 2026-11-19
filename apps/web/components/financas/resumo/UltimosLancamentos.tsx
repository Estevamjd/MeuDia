import Link from 'next/link';
import { ChevronRight, Plus, ReceiptText } from 'lucide-react';
import { clsx } from 'clsx';
import type { Transacao } from '@meudia/shared';
import { formatBRL, formatDiaMes } from '../../../lib/financas-ui';
import { VALOR_OCULTO } from '../../../lib/carteiras-ui';
import { CategoriaIcone } from '../CategoriaIcone';
import { OrigemSelo } from '../OrigemSelo';

export interface UltimosLancamentosProps {
  lancamentos: Transacao[];
  escondido?: boolean;
  onGastei?: () => void;
}

/** Últimos lançamentos do mês com o selo de origem (Manual ou WhatsApp) em cada linha. */
export function UltimosLancamentos({ lancamentos, escondido = false, onGastei }: UltimosLancamentosProps) {
  return (
    <section aria-labelledby="ultimos-lancamentos" className="lap-cartao px-4 pb-3 pt-4">
      <div className="mb-3.5 flex items-center justify-between gap-3">
        <h2 id="ultimos-lancamentos" className="text-base font-medium tracking-[-0.02em] text-text">
          Últimos lançamentos
        </h2>
        <span className="text-xs text-muted">Este mês</span>
      </div>
      {lancamentos.length === 0 ? (
        <div className="flex items-center gap-3 pb-2">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px] bg-trilho text-accent">
            <ReceiptText size={16} aria-hidden="true" />
          </span>
          <p className="text-[13px] leading-snug text-muted">Nada lançado neste mês. Toque em Gastei ou mande pelo WhatsApp quando o assistente estiver ligado.</p>
        </div>
      ) : (
        <ul>
          {lancamentos.map((t, i) => (
            <li
              key={t.id}
              data-testid="lancamento"
              className={clsx('grid grid-cols-[36px_minmax(0,1fr)_auto] items-start gap-x-3 py-2.5', i > 0 ? 'border-t border-border' : 'pt-0')}
            >
              <CategoriaIcone categoria={t.categoria} tamanho="sm" neutro className="!h-9 !w-9 !rounded-[10px]" />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium tracking-[-0.01em] text-text" title={t.descricao}>
                  {t.descricao}
                </p>
                <div className="mt-1 flex min-w-0 flex-wrap items-center gap-1.5">
                  <span className="whitespace-nowrap text-xs text-muted">
                    {t.categoria} · {formatDiaMes(t.data)}
                  </span>
                  <OrigemSelo t={t} />
                </div>
              </div>
              <span
                className={clsx(
                  'whitespace-nowrap pt-2 text-sm font-medium tracking-[-0.02em] tabular-nums',
                  t.tipo === 'receita' ? 'text-[var(--lap-h-positivo)]' : 'text-text',
                )}
              >
                {escondido ? VALOR_OCULTO : `${t.tipo === 'receita' ? '+' : '−'}${formatBRL(Number(t.valor))}`}
              </span>
            </li>
          ))}
        </ul>
      )}
      {onGastei && (
        <div className="mt-1 flex items-center justify-between gap-3 border-t border-border pt-2">
          <Link href="/financas/gastos" className="-ml-1 flex min-h-[44px] items-center gap-1 px-1 text-sm font-medium text-accent">
            Ver todos <ChevronRight size={16} aria-hidden="true" />
          </Link>
          <button
            type="button"
            onClick={onGastei}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-lg bg-accent px-5 text-sm font-medium text-accent-fg shadow-[0_0_24px_-6px_rgba(0,229,255,0.55)] transition-colors hover:bg-[#5cefff] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            <Plus size={16} aria-hidden="true" />
            Gastei
          </button>
        </div>
      )}
    </section>
  );
}
