'use client';

import dynamic from 'next/dynamic';
import { PieChart as PieIcon } from 'lucide-react';
import { CATEGORIA_OUTROS, type FatiaCategoria } from '@meudia/shared';
import { Skeleton } from '../../ui';
import { formatBRL, formatPct } from '../../../lib/financas-ui';
import { VALOR_OCULTO } from '../../../lib/carteiras-ui';
import { CategoriaIcone } from '../CategoriaIcone';
import { CardDashboard } from './CardDashboard';
import { CATEGORICAS, COR_OUTROS } from './paletaGraficos';

const RoscaCategoriasChart = dynamic(() => import('./RoscaCategoriasChart'), {
  ssr: false,
  loading: () => <Skeleton className="h-44 w-44 shrink-0 rounded-full" />,
});

export interface GraficoCategoriasProps {
  fatias: FatiaCategoria[];
  escondido: boolean;
}

/** Rosca dos gastos do mês por categoria (top 5 + Outros), com legenda: ícone, nome, valor e %. */
export function GraficoCategorias({ fatias, escondido }: GraficoCategoriasProps) {
  const total = fatias.reduce((s, f) => s + f.valor, 0);
  let slot = 0;
  const comCor = fatias.map((f) => ({ ...f, cor: f.categoria === CATEGORIA_OUTROS ? COR_OUTROS : CATEGORICAS[slot++ % CATEGORICAS.length]! }));

  return (
    <CardDashboard id="grafico-categorias" titulo="Gastos do mês por categoria" icone={<PieIcon size={20} />}>
      {fatias.length === 0 ? (
        <p className="text-[15px] text-muted">Nenhum gasto neste mês ainda. Use o “+” para lançar o primeiro.</p>
      ) : (
        <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
          {!escondido && <RoscaCategoriasChart fatias={comCor} total={total} />}
          <ul className="w-full min-w-0 space-y-2" aria-label="Legenda dos gastos por categoria">
            {comCor.map((f) => (
              <li key={f.categoria} className="flex items-center gap-2 text-[13px]">
                <span aria-hidden="true" className="h-3 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: f.cor }} />
                <CategoriaIcone categoria={f.categoria} tamanho="sm" />
                <span className="min-w-0 flex-1 truncate text-text">{f.categoria}</span>
                <span className="whitespace-nowrap tabular-nums text-text">{escondido ? VALOR_OCULTO : formatBRL(f.valor)}</span>
                <span className="w-9 shrink-0 text-right tabular-nums text-muted">{formatPct(total ? f.valor / total : null)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </CardDashboard>
  );
}
