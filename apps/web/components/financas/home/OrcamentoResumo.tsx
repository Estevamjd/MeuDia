import Link from 'next/link';
import { clsx } from 'clsx';
import { formatBRL } from '../../../lib/financas-ui';

export interface CategoriaOrcamento {
  categoria: string;
  gasto: number;
  limite: number;
}

export interface OrcamentoResumoProps {
  /** Até 3 categorias com limite, as mais comprometidas primeiro. */
  categorias: CategoriaOrcamento[];
}

/** Progresso do orçamento por categoria; vermelho quando estoura o limite. */
export function OrcamentoResumo({ categorias }: OrcamentoResumoProps) {
  if (categorias.length === 0) return null;

  return (
    <section aria-labelledby="orcamento-resumo" className="space-y-3 rounded-card border border-border bg-card p-4">
      <h2 id="orcamento-resumo" className="text-[15px] font-semibold text-text">
        Orçamento
      </h2>
      <ul className="space-y-3">
        {categorias.map(({ categoria, gasto, limite }) => {
          const estourou = gasto > limite;
          const pct = limite > 0 ? Math.min((gasto / limite) * 100, 100) : 100;
          return (
            <li key={categoria} className="space-y-1">
              <div className="flex items-baseline justify-between gap-3">
                <span className="min-w-0 truncate text-[15px] text-text">{categoria}</span>
                <span className="shrink-0 text-[13px] text-muted">
                  <span className={clsx('whitespace-nowrap font-semibold tabular-nums', estourou ? 'text-red' : 'text-text')}>
                    {formatBRL(gasto)}
                  </span>{' '}
                  de <span className="whitespace-nowrap tabular-nums">{formatBRL(limite)}</span>
                </span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-card2" aria-hidden="true">
                <div className={clsx('h-full rounded-full', estourou ? 'bg-red' : 'bg-accent')} style={{ width: `${pct}%` }} />
              </div>
              <p className={clsx('text-[13px]', estourou ? 'text-red' : 'text-muted')}>
                {estourou ? 'passou ' : 'restam '}
                <span className="whitespace-nowrap tabular-nums">{formatBRL(Math.abs(limite - gasto))}</span>
                {estourou ? ' do limite' : ''}
              </p>
            </li>
          );
        })}
      </ul>
      <Link href="/financas/orcamento" className="inline-block text-sm font-medium text-accent hover:underline">
        Ver orçamento
      </Link>
    </section>
  );
}
