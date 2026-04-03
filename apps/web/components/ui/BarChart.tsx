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
  color = '#7c6aff',
  height = 200,
}: BarChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <RechartsBarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
        <XAxis
          dataKey={xAxisKey}
          tick={{ fill: '#65657a', fontSize: 11 }}
          axisLine={{ stroke: 'rgba(255,255,255,0.07)' }}
          tickLine={false}
        />
        <YAxis
          tick={{ fill: '#65657a', fontSize: 11 }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          contentStyle={{
            background: '#16161f',
            border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: '8px',
            fontSize: '12px',
            color: '#eeeef8',
          }}
          cursor={{ fill: 'rgba(255,255,255,0.03)' }}
        />
        <Bar dataKey={dataKey} fill={color} radius={[4, 4, 0, 0]} />
      </RechartsBarChart>
    </ResponsiveContainer>
  );
}
