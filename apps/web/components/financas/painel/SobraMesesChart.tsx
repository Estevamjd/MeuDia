'use client';

import { Bar, BarChart, Cell, LabelList, ResponsiveContainer, XAxis } from 'recharts';
import { formatBRL } from '../../../lib/financas-ui';
import { GRADE, TINTA_MUTED } from '../home/paletaGraficos';
import type { SobraMes } from './montarPainel';

const COR = '#199e70';
const COR_NEGATIVA = '#d95926';

/** Barras do que sobrou em cada mês; o mês corrente (previsão) fica mais claro. */
export default function SobraMesesChart({ meses }: { meses: SobraMes[] }) {
  return (
    <div className="h-40 w-full" role="img" aria-label={`Sobra por mês: ${meses.map((m) => `${m.rotulo} ${formatBRL(m.valor)}${m.previsao ? ' (previsão)' : ''}`).join(', ')}`}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={meses} margin={{ top: 18, right: 4, bottom: 0, left: 4 }}>
          <XAxis dataKey="rotulo" tick={{ fill: TINTA_MUTED, fontSize: 11 }} tickLine={false} axisLine={{ stroke: GRADE }} />
          <Bar dataKey="valor" radius={[6, 6, 0, 0]} isAnimationActive={false} maxBarSize={34}>
            {meses.map((m) => {
              const cor = m.valor < 0 ? COR_NEGATIVA : COR;
              return <Cell key={m.competencia} fill={cor} fillOpacity={m.previsao ? 0.45 : 1} stroke={m.previsao ? cor : undefined} strokeDasharray={m.previsao ? '3 3' : undefined} />;
            })}
            <LabelList dataKey="valor" position="top" formatter={(v: number) => Math.round(v)} style={{ fill: 'var(--grafico-texto)', fontSize: 11 }} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
