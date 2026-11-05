'use client';

import type { ReactNode } from 'react';
import { clsx } from 'clsx';
import { seloRefeicao } from '@meudia/shared';
import type { EntradaRefeicao } from '../../lib/refeicoes-dia';
import { resumoItens } from '../../lib/refeicoes-dia';

/**
 * Linha do tempo das refeições (design-system §4): hora em Syne, ponto de 11px (cheio = feita, vazado = pendente),
 * trilho de 1px --accent3 a 30%, nome 700, itens em --muted-text e kcal à direita. Tocar no ponto marca/desmarca.
 */
export function LinhaTempo({
  entradas,
  onPonto,
  comKcal = false,
  acoes,
  ocupado,
}: {
  entradas: readonly EntradaRefeicao[];
  onPonto: (e: EntradaRefeicao) => void;
  /** Dieta: kcal à direita, selo e ações. Hoje: só "· feita". */
  comKcal?: boolean;
  acoes?: (e: EntradaRefeicao) => ReactNode;
  ocupado?: string | null;
}) {
  return (
    <ol className="relative">
      {entradas.map((e, i) => (
        <li key={e.chave} className="relative grid grid-cols-[52px_32px_1fr] items-start">
          <span className="pt-[14px] font-syne text-[13px] font-bold text-text tabular-nums">{e.horario}</span>
          <span className="relative flex h-full justify-center">
            {/* trilho vertical */}
            <span
              aria-hidden="true"
              className={clsx('absolute left-1/2 w-px -translate-x-1/2 bg-accent3/30', i === 0 ? 'top-[18px]' : 'top-0', i === entradas.length - 1 ? 'h-[18px]' : 'bottom-0')}
            />
            <button
              type="button"
              role="checkbox"
              aria-checked={e.feita}
              aria-label={`${e.nome} feita`}
              disabled={ocupado === e.chave}
              onClick={() => onPonto(e)}
              className="relative z-[1] -mt-0.5 inline-flex h-11 w-11 items-center justify-center disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent3"
            >
              <span
                aria-hidden="true"
                className={clsx('block h-[11px] w-[11px] rounded-full', e.feita ? 'bg-accent3' : 'border-[1.5px] border-accent3 bg-bg')}
              />
            </button>
          </span>
          <div className={clsx('min-w-0 py-[13px]', i < entradas.length - 1 && 'border-b border-white/[0.07]')}>
            <div className="flex items-baseline justify-between gap-3">
              <p className="min-w-0 text-[15px] text-text">
                <span className="font-bold">{e.nome}</span>
                {!comKcal && e.feita && <span className="text-[13px] text-muted-text"> · feita</span>}
              </p>
              {comKcal && <Kcal entrada={e} />}
            </div>
            <p className="mt-0.5 text-[13.5px] text-muted-text">{resumoItens(e.itens)}</p>
            {comKcal && (
              <div className="mt-2 flex flex-wrap items-center justify-between gap-x-3">
                {/* Pendente do modelo não tem valor: selo de origem só em refeição registrada. */}
                {e.feita ? <SeloTaco origem={seloRefeicao(e.itens)} /> : <span />}
                <div className="flex items-center gap-x-1">{acoes?.(e)}</div>
              </div>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}

function Kcal({ entrada }: { entrada: EntradaRefeicao }) {
  const total = entrada.total;
  if (!total || total.kcal === null) {
    return <span className="shrink-0 text-[12px] italic text-muted-text">sem valor</span>;
  }
  return (
    <span className="shrink-0 text-right">
      <span className="font-syne text-[18px] font-bold text-text tabular-nums">{total.kcal.toLocaleString('pt-BR')}</span>
      {total.itensSemValor > 0 && <span className="block text-[11px] italic text-muted-text">parcial</span>}
    </span>
  );
}

/** "ref. TACO" (--accent3) só quando os valores vieram da TACO; o resto "fora da TACO" em cinza. */
export function SeloTaco({ origem }: { origem: 'taco' | 'fora' }) {
  return origem === 'taco' ? (
    <span className="rounded-[2px] border border-accent3/50 px-2 py-0.5 text-[10px] uppercase tracking-[1.4px] text-accent3">ref. TACO</span>
  ) : (
    <span className="rounded-[2px] border border-[#6a6a80] px-2 py-0.5 text-[10px] uppercase tracking-[1.4px] text-muted-text">fora da TACO</span>
  );
}
