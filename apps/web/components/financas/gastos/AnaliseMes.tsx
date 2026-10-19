import type { ReactNode } from 'react';
import { clsx } from 'clsx';
import { TrendingDown, TrendingUp } from 'lucide-react';
import type { FatiaCategoria, PontoEvolucao } from '@meudia/shared';
import { formatBRL, formatPct } from '../../../lib/financas-ui';
import { VALOR_OCULTO } from '../../../lib/carteiras-ui';
import { CardDashboard } from '../home/CardDashboard';
import { GraficoCategorias } from '../home/GraficoCategorias';
import { GraficoEvolucao } from '../home/GraficoEvolucao';
import type { Analise } from './montarAnalise';

export interface AnaliseMesProps {
  analise: Analise;
  fatias: FatiaCategoria[];
  evolucao: PontoEvolucao[];
  escondido: boolean;
  /** Lista das entradas do mês (editar/excluir; o Recebi vira desfazer). */
  listaEntradas?: ReactNode;
}

function Linha({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return (
    <p className="flex flex-wrap items-baseline justify-between gap-x-3 text-[15px]">
      <span className="text-muted">{rotulo}</span>{' '}
      <span className="tabular-nums text-text">{children}</span>
    </p>
  );
}

function Chip({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <li className="flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-[13px]">
      <span className="text-muted">{rotulo}</span>{' '}
      <span className="whitespace-nowrap font-semibold tabular-nums text-text">{valor}</span>
    </li>
  );
}

/**
 * Gastos › Análise (DIAG-CARD-ENTROU §5): Entrou = salário recebido X de Y + extras; Saiu = gasto + contas do mês
 * (pagas/faltam); comparação só com dados no mês anterior; percentuais com a base escrita. A única sobra do app é o
 * "No fim do mês sobra" da Início: aqui não há outra.
 */
export function AnaliseMes({ analise: a, fatias, evolucao, escondido, listaEntradas }: AnaliseMesProps) {
  const v = (n: number) => (escondido ? VALOR_OCULTO : formatBRL(n));
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <CardDashboard id="analise-entrou" titulo="Entrou" icone={<TrendingUp size={20} />} corIcone="bg-green/[0.14] text-green">
          <Linha rotulo="Salário">
            recebido {v(a.entradas.salarioRecebido)} de {v(a.entradas.salarioPrevisto)}
          </Linha>
          <Linha rotulo="Extras">{v(a.entradas.extras)}</Linha>
          {listaEntradas}
        </CardDashboard>
        <CardDashboard id="analise-saiu" titulo="Saiu" icone={<TrendingDown size={20} />} corIcone="bg-red/[0.14] text-red">
          <Linha rotulo="Saiu">{v(a.saiu.gasto)}</Linha>
          <Linha rotulo="Contas do mês">
            {v(a.saiu.contasMes)} (pagas {v(a.saiu.contasPagas)}, faltam {v(a.saiu.contasFaltam)})
          </Linha>
          {a.comparacao ? (
            <p className={clsx('text-[13px]', a.comparacao.aumentou ? 'text-red' : 'text-green')}>{a.comparacao.texto}</p>
          ) : (
            a.primeiroMes && <p className="text-[13px] text-muted">Primeiro mês no app: sem comparação com o mês anterior.</p>
          )}
        </CardDashboard>
      </div>

      <section aria-labelledby="analise-indicadores" className="space-y-2">
        <h2 id="analise-indicadores" className="sr-only">Indicadores do mês</h2>
        {a.pctRendaUsada !== null && (
          <p className="text-[15px] text-text">
            Usou <span className="tabular-nums">{formatPct(a.pctRendaUsada)}</span> da renda do mês (salário + extras)
          </p>
        )}
        <ul className="flex flex-wrap gap-2">
          {a.pctContasFixas !== null && <Chip rotulo="Contas fixas:" valor={`${formatPct(a.pctContasFixas)} do salário`} />}
          <Chip rotulo="Pagas em dia" valor={formatPct(a.pagasEmDia)} />
        </ul>
      </section>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <GraficoCategorias fatias={fatias} escondido={escondido} />
        <GraficoEvolucao pontos={evolucao} escondido={escondido} />
      </div>
    </div>
  );
}
