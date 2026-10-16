import { formatPct } from '../../../lib/financas-ui';

export interface IndicadoresMesProps {
  pctComprometida: number | null;
  /** `null` = nenhuma conta venceu ainda (chip oculto). */
  pagasNoPrazo: number | null;
}

function Chip({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <li className="flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-[13px]">
      <span className="text-muted">{rotulo}</span>
      <span className="whitespace-nowrap font-semibold tabular-nums text-text">{valor}</span>
    </li>
  );
}

/** Chips "Renda comprometida" e "Pagas em dia". */
export function IndicadoresMes({ pctComprometida, pagasNoPrazo }: IndicadoresMesProps) {
  if (pctComprometida === null && pagasNoPrazo === null) return null;

  return (
    <ul aria-label="Indicadores do mês" className="flex flex-wrap gap-2">
      {pctComprometida !== null && <Chip rotulo="Renda comprometida" valor={formatPct(pctComprometida)} />}
      {pagasNoPrazo !== null && <Chip rotulo="Pagas em dia" valor={formatPct(pagasNoPrazo)} />}
    </ul>
  );
}
