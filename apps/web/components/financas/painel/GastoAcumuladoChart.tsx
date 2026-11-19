'use client';

import { Area, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { formatBRL } from '../../../lib/financas-ui';
import { COR_SALDO, GRADE, TINTA_MUTED } from '../home/paletaGraficos';
import type { PontoAcumulado } from './montarPainel';

const COR_RENDA = '#199e70';
const compacto = (v: number) => new Intl.NumberFormat('pt-BR', { notation: 'compact', maximumFractionDigits: 1 }).format(v);

/** Gasto acumulado do mês (área azul), previsto até o fim do mês (pontilhado) e a renda (linha verde tracejada). */
export default function GastoAcumuladoChart({ pontos, renda }: { pontos: PontoAcumulado[]; renda: number }) {
  const maior = Math.max(renda, ...pontos.map((p) => Math.max(p.gasto ?? 0, p.previsto ?? 0)));
  return (
    <div className="h-44 w-full" role="img" aria-label={`Gasto acumulado no mês${renda > 0 ? `, comparado com a renda de ${formatBRL(renda)}` : ''}`}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={pontos} margin={{ top: 14, right: 8, bottom: 0, left: 0 }}>
          <XAxis dataKey="dia" tick={{ fill: TINTA_MUTED, fontSize: 11 }} tickLine={false} axisLine={{ stroke: GRADE }} ticks={[1, 10, 20, pontos.length]} />
          <YAxis tick={{ fill: TINTA_MUTED, fontSize: 11 }} tickLine={false} axisLine={false} width={40} tickFormatter={compacto} domain={[0, Math.ceil(maior * 1.1)]} />
          <Tooltip
            contentStyle={{ background: 'var(--grafico-tooltip)', border: '1px solid var(--grafico-borda)', borderRadius: 8, color: 'var(--grafico-texto)' }}
            labelStyle={{ color: TINTA_MUTED }}
            labelFormatter={(d) => `Dia ${d}`}
            formatter={(v: number, nome: string) => [formatBRL(v), nome === 'gasto' ? 'Já gasto' : 'Previsto']}
          />
          {renda > 0 && (
            <ReferenceLine y={renda} stroke={COR_RENDA} strokeDasharray="5 4" strokeWidth={1.5} label={{ value: `renda ${formatBRL(renda)}`, position: 'insideTopRight', fill: COR_RENDA, fontSize: 10 }} />
          )}
          <Area type="monotone" dataKey="gasto" stroke={COR_SALDO} strokeWidth={2.2} fill={COR_SALDO} fillOpacity={0.14} connectNulls={false} isAnimationActive={false} dot={false} />
          <Line type="linear" dataKey="previsto" stroke={COR_SALDO} strokeWidth={1.6} strokeDasharray="3 3" dot={false} connectNulls={false} isAnimationActive={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
