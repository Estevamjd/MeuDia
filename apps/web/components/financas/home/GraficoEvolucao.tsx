'use client';

import dynamic from 'next/dynamic';
import { TrendingUp } from 'lucide-react';
import type { PontoEvolucao } from '@meudia/shared';
import { Skeleton } from '../../ui';
import { formatBRL } from '../../../lib/financas-ui';
import { CardDashboard } from './CardDashboard';

const EvolucaoMesChart = dynamic(() => import('./EvolucaoMesChart'), {
  ssr: false,
  loading: () => <Skeleton className="h-64 w-full" />,
});

export interface GraficoEvolucaoProps {
  pontos: PontoEvolucao[];
  escondido: boolean;
}

/** Evolução do mês: saldo no fim de cada dia (linha) e gasto por dia (barras). */
export function GraficoEvolucao({ pontos, escondido }: GraficoEvolucaoProps) {
  const gastoTotal = pontos.reduce((s, p) => s + p.gasto, 0);
  const maior = pontos.reduce<PontoEvolucao | null>((m, p) => (p.gasto > (m?.gasto ?? 0) ? p : m), null);
  // Mesmas regras do gráfico: linha com 2+ dias de saldo, barras com algum gasto.
  const vazio = gastoTotal === 0 && pontos.filter((p) => p.saldo !== null).length < 2;
  return (
    <CardDashboard id="grafico-evolucao" titulo="Evolução do mês" icone={<TrendingUp size={20} />}>
      {vazio ? (
        <p className="text-[15px] text-muted">O gráfico aparece com o primeiro gasto do mês ou a partir do 2º dia com saldo.</p>
      ) : escondido ? (
        <p className="text-[15px] text-muted">Valores escondidos.</p>
      ) : (
        <>
          {maior && (
            <p className="text-[13px] text-muted">
              Dia com mais gasto: <span className="text-text">{maior.dia}</span> ({formatBRL(maior.gasto)})
            </p>
          )}
          <EvolucaoMesChart pontos={pontos} />
        </>
      )}
    </CardDashboard>
  );
}
