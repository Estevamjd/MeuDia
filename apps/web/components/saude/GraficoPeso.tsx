'use client';

import { CartesianGrid, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Scatter, XAxis, YAxis } from 'recharts';
import type { PontoGraficoPeso } from '@meudia/shared';

const fmtKg = (n: number) => n.toLocaleString('pt-BR', { maximumFractionDigits: 1 });

/**
 * Gráfico de peso (design-system §4, tela 04): pontos diários de 2,6px (#5a5a70), média simples de 7 dias
 * numa linha de 2,6px --accent3 e a meta tracejada --yellow com rótulo. Sem animação. Legenda em texto embaixo.
 */
export function GraficoPeso({ pontos, metaKg }: { pontos: readonly PontoGraficoPeso[]; metaKg: number | null }) {
  const valores = pontos.flatMap((p) => [p.peso, p.media7]).filter((v): v is number => v !== null);
  if (metaKg) valores.push(metaKg);
  const min = Math.floor(Math.min(...valores) - 1);
  const max = Math.ceil(Math.max(...valores) + 1);
  const dados = pontos.map((p) => ({ ...p }));
  return (
    <figure>
      <div className="h-[190px] w-full" role="img" aria-label={`Peso dos últimos ${pontos.length} dias${metaKg ? `, meta ${fmtKg(metaKg)} kg` : ''}`}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={dados} margin={{ top: 22, right: 6, bottom: 0, left: 6 }}>
            <CartesianGrid stroke="rgba(255,255,255,0.04)" vertical={false} />
            <XAxis dataKey="data" hide />
            <YAxis domain={[min, max]} hide />
            {metaKg && (
              <ReferenceLine
                y={metaKg}
                stroke="#fbbf24"
                strokeDasharray="6 6"
                strokeWidth={1.5}
                label={(p: { viewBox?: { x?: number; y?: number; width?: number } }) => (
                  // Rótulo acima do tracejado, alinhado à direita (tela 04).
                  <text x={(p.viewBox?.x ?? 0) + (p.viewBox?.width ?? 0)} y={(p.viewBox?.y ?? 0) - 7} textAnchor="end" fill="#fbbf24" fontSize={12}>
                    meta {fmtKg(metaKg)} kg
                  </text>
                )}
              />
            )}
            <Scatter dataKey="peso" fill="#5a5a70" isAnimationActive={false} shape={<Ponto />} />
            <Line
              type="monotone"
              dataKey="media7"
              stroke="#6affda"
              strokeWidth={2.6}
              dot={false}
              connectNulls
              isAnimationActive={false}
              activeDot={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <figcaption className="mt-2 text-[13px] text-muted-text">pontos = peso do dia · linha = média 7 dias{metaKg ? ' · tracejado = meta' : ''}</figcaption>
    </figure>
  );
}

function Ponto(props: { cx?: number; cy?: number; payload?: { peso: number | null } }) {
  if (props.cx === undefined || props.cy === undefined || props.payload?.peso === null) return <g />;
  return <circle cx={props.cx} cy={props.cy} r={2.6} fill="#5a5a70" />;
}
