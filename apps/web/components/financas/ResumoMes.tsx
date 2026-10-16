'use client';

import Link from 'next/link';
import { TrendingUp, TrendingDown, PiggyBank, Percent, CalendarCheck } from 'lucide-react';
import { Badge, SkeletonCard, StatCard } from '../ui';
import { useResumoFinanceiroMes } from '../../hooks';
import { formatBRL, formatPct, SELO_UI, textoDelta } from '../../lib/financas-ui';

/** Selo + renda × gasto, sobra prevista × real, % comprometida, pagas no prazo e mês anterior. */
export function ResumoMes({ ano, mes }: { ano: number; mes: number }) {
  const { data: resumo, isLoading, isError } = useResumoFinanceiroMes(ano, mes);

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>
    );
  }
  if (isError || !resumo) {
    return (
      <p role="alert" className="rounded-card border border-red/40 bg-card p-3 text-sm text-text">
        Não foi possível carregar o resumo do mês.
      </p>
    );
  }

  return (
    <section aria-label="Resumo do mês" className="space-y-4">
      {resumo.selo ? (
        <div className="flex flex-wrap items-center gap-3 rounded-card border border-border bg-card p-4" role="status">
          <span className="text-sm text-muted">Situação do mês:</span>
          <Badge color={SELO_UI[resumo.selo].color}>{resumo.selo}</Badge>
          <span className="text-sm text-muted">{SELO_UI[resumo.selo].descricao}</span>
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-accent/30 bg-card p-4">
          <span className="text-sm text-text">Cadastre sua renda para ver o selo e a sobra do mês.</span>
          <Link href="/financas/orcamento" className="text-sm font-medium text-accent hover:underline">
            Cadastrar renda
          </Link>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          label="Renda (real / prevista)"
          value={`${formatBRL(resumo.rendaReal)} / ${formatBRL(resumo.rendaPrevista)}`}
          icon={<TrendingUp size={16} />}
          tag={{ text: 'entradas', color: 'green' }}
        />
        <StatCard
          label="Gasto (real / previsto)"
          value={`${formatBRL(resumo.gastoReal)} / ${formatBRL(resumo.gastoPrevisto)}`}
          icon={<TrendingDown size={16} />}
          tag={{ text: textoDelta(resumo.vsMesAnterior.gastoReal), color: resumo.vsMesAnterior.gastoReal.absoluto > 0 ? 'red' : 'teal' }}
        />
        <StatCard
          label="Sobra (real / prevista)"
          value={`${formatBRL(resumo.sobraReal)} / ${formatBRL(resumo.sobraPrevista)}`}
          icon={<PiggyBank size={16} />}
          tag={{ text: textoDelta(resumo.vsMesAnterior.sobraReal), color: resumo.sobraReal >= 0 ? 'teal' : 'red' }}
        />
        <StatCard
          label="Renda comprometida com contas"
          value={formatPct(resumo.pctComprometida)}
          icon={<Percent size={16} />}
          tag={{ text: `contas ${formatBRL(resumo.contasMes)}`, color: 'purple' }}
        />
        <StatCard
          label="Contas pagas no prazo"
          value={formatPct(resumo.pagasNoPrazo)}
          icon={<CalendarCheck size={16} />}
          tag={{ text: resumo.pagasNoPrazo === null ? 'nada venceu ainda' : 'das que já venceram', color: 'yellow' }}
        />
      </div>
    </section>
  );
}
