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
  color = '#7c6aff',
  height = 200,
}: LineChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <RechartsLineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
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
