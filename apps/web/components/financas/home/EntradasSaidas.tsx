import { clsx } from 'clsx';
import { TrendingDown, TrendingUp } from 'lucide-react';
import { formatBRL } from '../../../lib/financas-ui';

export interface EntradasSaidasProps {
  rendaReal: number;
  rendaPrevista: number;
  gastoReal: number;
  gastoPrevisto: number;
  /** Comparativo do gasto com o mês anterior; `null` quando igual (oculto). */
  comparativoGasto: { texto: string; aumentou: boolean } | null;
}

function Coluna({
  rotulo,
  icone,
  valor,
  previsto,
}: {
  rotulo: string;
  icone: React.ReactNode;
  valor: number;
  previsto: number;
}) {
  return (
    <div className="min-w-0 rounded-card border border-border bg-card p-4">
      <p className="flex items-center gap-1.5 text-[13px] font-medium text-muted">
        {icone}
        {rotulo}
      </p>
      <p
        className="mt-1 whitespace-nowrap font-semibold tabular-nums text-text"
        style={{ fontSize: 'clamp(0.95rem, 4.6vw, 1.125rem)' }}
      >
        {formatBRL(valor)}
      </p>
      <p className="text-[13px] text-muted">
        de <span className="whitespace-nowrap tabular-nums">{formatBRL(previsto)}</span> previstos
      </p>
    </div>
  );
}

/** "Entrou × Saiu": real em destaque, previsto na sublinha (nunca dois valores no mesmo campo). */
export function EntradasSaidas({ rendaReal, rendaPrevista, gastoReal, gastoPrevisto, comparativoGasto }: EntradasSaidasProps) {
  return (
    <section aria-label="Entrou e saiu no mês" className="space-y-2">
      <div className="grid grid-cols-2 gap-3">
        <Coluna rotulo="Entrou" icone={<TrendingUp size={14} aria-hidden="true" />} valor={rendaReal} previsto={rendaPrevista} />
        <Coluna rotulo="Saiu" icone={<TrendingDown size={14} aria-hidden="true" />} valor={gastoReal} previsto={gastoPrevisto} />
      </div>
      {comparativoGasto && (
        <p className={clsx('text-[13px]', comparativoGasto.aumentou ? 'text-red' : 'text-green')}>
          Saiu {comparativoGasto.texto}
        </p>
      )}
    </section>
  );
}
