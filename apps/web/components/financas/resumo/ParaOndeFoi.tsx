import { PieChart } from 'lucide-react';
import { formatBRL } from '../../../lib/financas-ui';
import { VALOR_OCULTO } from '../../../lib/carteiras-ui';
import type { CategoriaResumo } from './montarResumoMes';

/** Gastos do mês por categoria (top 5 + Outros), barra ciano proporcional ao total. */
export function ParaOndeFoi({ categorias, escondido = false }: { categorias: CategoriaResumo[]; escondido?: boolean }) {
  return (
    <section aria-labelledby="para-onde-foi" className="lap-cartao px-4 pb-3.5 pt-4">
      <h2 id="para-onde-foi" className="mb-3.5 text-base font-medium tracking-[-0.02em] text-text">
        Para onde foi
      </h2>
      {categorias.length === 0 ? (
        <div className="flex items-center gap-3 py-1">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px] bg-trilho text-accent">
            <PieChart size={16} aria-hidden="true" />
          </span>
          <p className="text-[13px] leading-snug text-muted">Nenhum gasto neste mês ainda. Assim que você lançar, as categorias aparecem aqui.</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {categorias.map((c) => (
            <li key={c.categoria} className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-0.5">
              <span className="min-w-0 truncate text-sm font-medium tracking-[-0.01em] text-text">{c.categoria}</span>
              <span className="whitespace-nowrap text-right text-[13px] text-muted tabular-nums">
                {escondido ? VALOR_OCULTO : formatBRL(c.valor)} · {c.pct === 0 && c.valor > 0 ? '<1' : c.pct}%
              </span>
              <span className="col-span-2 mt-1 block h-[5px] overflow-hidden rounded-full bg-trilho" aria-hidden="true">
                <span className="block h-full rounded-full bg-accent/85" style={{ width: `${Math.max(c.pct, 2)}%` }} />
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
