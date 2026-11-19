'use client';

import {
  BarChart as RechartsBarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

interface BarChartProps {
  data: Record<string, unknown>[];
  dataKey: string;
  xAxisKey?: string;
  color?: string;
  height?: number;
}

export function BarChart({
  data,
  dataKey,
  xAxisKey = 'label',
  color = '#00e5ff',
  height = 200,
}: BarChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <RechartsBarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(120,135,160,0.16)" vertical={false} />
        <XAxis
          dataKey={xAxisKey}
          tick={{ fill: '#7a8599', fontSize: 11 }}
          axisLine={{ stroke: 'rgba(120,135,160,0.16)' }}
          tickLine={false}
        />
        <YAxis
          tick={{ fill: '#7a8599', fontSize: 11 }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          contentStyle={{
            background: 'var(--grafico-tooltip)',
            border: '1px solid var(--grafico-borda)',
            borderRadius: '8px',
            fontSize: '12px',
            color: 'var(--grafico-texto)',
          }}
          cursor={{ fill: 'rgba(120,135,160,0.16)' }}
        />
        <Bar dataKey={dataKey} fill={color} radius={[4, 4, 0, 0]} />
      </RechartsBarChart>
    </ResponsiveContainer>
  );
}
