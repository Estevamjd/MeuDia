'use client';

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { formatBRL } from '../../../lib/financas-ui';
import { SUPERFICIE } from './paletaGraficos';

export interface FatiaRosca {
  categoria: string;
  valor: number;
  cor: string;
}

/** Só o SVG (carregado com next/dynamic, ssr:false). A legenda com valores fica fora, em HTML. */
export default function RoscaCategoriasChart({ fatias, total }: { fatias: FatiaRosca[]; total: number }) {
  return (
    <div className="relative h-44 w-44 shrink-0" role="img" aria-label={`Gastos do mês por categoria, total ${formatBRL(total)}`}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={fatias}
            dataKey="valor"
            nameKey="categoria"
            innerRadius="62%"
            outerRadius="100%"
            paddingAngle={fatias.length > 1 ? 1 : 0}
            stroke={SUPERFICIE}
            strokeWidth={2}
            isAnimationActive={false}
          >
            {fatias.map((f) => (
              <Cell key={f.categoria} fill={f.cor} />
            ))}
          </Pie>
          <Tooltip
            formatter={(v: number, nome: string) => [formatBRL(v), nome]}
            contentStyle={{ background: '#1c1c28', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#eeeef8' }}
            itemStyle={{ color: '#eeeef8' }}
          />
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="text-[11px] text-muted">Total</span>
        <span className="text-sm font-semibold tabular-nums text-text">{formatBRL(total)}</span>
      </div>
    </div>
  );
}
