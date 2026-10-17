'use client';

import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { PontoEvolucao } from '@meudia/shared';
import { formatBRL } from '../../../lib/financas-ui';
import { COR_GASTO, COR_SALDO, GRADE, SUPERFICIE, TINTA_MUTED } from './paletaGraficos';

const compacto = (v: number) => new Intl.NumberFormat('pt-BR', { notation: 'compact', maximumFractionDigits: 1 }).format(v);
const tooltip = {
  contentStyle: { background: '#1c1c28', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#eeeef8' },
  itemStyle: { color: '#eeeef8' },
  labelStyle: { color: TINTA_MUTED },
};
const eixoX = { dataKey: 'dia', tick: { fill: TINTA_MUTED, fontSize: 11 }, tickLine: false, axisLine: false, interval: 'preserveStartEnd' as const, minTickGap: 12 };
const eixoY = { tick: { fill: TINTA_MUTED, fontSize: 11 }, tickLine: false, axisLine: false, width: 40, tickFormatter: compacto };

/**
 * Small multiples com o mesmo eixo X (dia): linha do saldo no fim do dia em cima, barras do gasto do dia embaixo.
 * Um eixo Y por gráfico (nada de eixo duplo: saldo e gasto têm escalas diferentes).
 */
export default function EvolucaoMesChart({ pontos }: { pontos: PontoEvolucao[] }) {
  // Linha só com 2+ dias de saldo; barras só com algum gasto (sem eixo vazio).
  const temSaldo = pontos.filter((p) => p.saldo !== null).length >= 2;
  const temGasto = pontos.some((p) => p.gasto > 0);
  return (
    <div className="space-y-3">
      {temSaldo && (
        <figure className="space-y-1">
          <figcaption className="text-[12px] text-muted">Saldo no fim do dia</figcaption>
          <div className="h-32 w-full" role="img" aria-label="Linha do saldo total no fim de cada dia do mês">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={pontos} margin={{ top: 6, right: 8, bottom: 0, left: 0 }}>
                <CartesianGrid stroke={GRADE} vertical={false} />
                <XAxis {...eixoX} />
                <YAxis {...eixoY} domain={['auto', 'auto']} />
                <Tooltip {...tooltip} formatter={(v: number) => [formatBRL(v), 'Saldo']} labelFormatter={(d) => `Dia ${d}`} />
                <Line
                  type="monotone"
                  dataKey="saldo"
                  stroke={COR_SALDO}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4, stroke: SUPERFICIE, strokeWidth: 2 }}
                  connectNulls={false}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </figure>
      )}
      {temGasto && (
      <figure className="space-y-1">
        <figcaption className="text-[12px] text-muted">Gasto por dia</figcaption>
        <div className="h-28 w-full" role="img" aria-label="Barras do gasto de cada dia do mês">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={pontos} margin={{ top: 6, right: 8, bottom: 0, left: 0 }} barCategoryGap={2}>
              <CartesianGrid stroke={GRADE} vertical={false} />
              <XAxis {...eixoX} />
              <YAxis {...eixoY} allowDecimals={false} />
              <Tooltip {...tooltip} cursor={{ fill: 'rgba(255,255,255,0.04)' }} formatter={(v: number) => [formatBRL(v), 'Gasto']} labelFormatter={(d) => `Dia ${d}`} />
              <Bar dataKey="gasto" fill={COR_GASTO} radius={[4, 4, 0, 0]} maxBarSize={14} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </figure>
      )}
    </div>
  );
}
