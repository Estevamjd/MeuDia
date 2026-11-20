'use client';

import {
  LineChart as RechartsLineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

interface LineChartProps {
  data: Record<string, unknown>[];
  dataKey: string;
  xAxisKey?: string;
  color?: string;
  height?: number;
}

export function LineChart({
  data,
  dataKey,
  xAxisKey = 'data',
  color = 'var(--accent)', // segue a cor do app (variável CSS vale em atributo de SVG)
  height = 200,
}: LineChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <RechartsLineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(120,135,160,0.16)" />
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
        />
        <Line
          type="monotone"
          dataKey={dataKey}
          stroke={color}
          strokeWidth={2}
          dot={{ r: 3, fill: color }}
          activeDot={{ r: 5, fill: color }}
        />
      </RechartsLineChart>
    </ResponsiveContainer>
  );
}
