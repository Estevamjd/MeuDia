'use client';

import { useId } from 'react';
import { clsx } from 'clsx';
import { Minus, Plus } from 'lucide-react';
import { PARCELAS_MAX, dividirParcelas, type ParcelaPlanejada } from '@meudia/shared';
import { formatBRL, formatDiaMes } from '../../lib/financas-ui';

export const PARCELAS_MIN = 2;
/** Começa em 2×: o menor parcelamento, a pessoa sobe no + até o da compra. */
export const PARCELAS_PADRAO = 2;

/** Mensagem quando ainda não há total digitado (vazio ou zero): convite, não erro. */
export const MENSAGEM_TOTAL_VAZIO = 'Digite o valor total da compra.';

export type AvaliacaoParcelas =
  | { plano: ParcelaPlanejada[]; erro: null }
  /** `erro` null = nada digitado ainda; texto = a validação de `dividirParcelas` (pt-BR), mostrada como veio. */
  | { plano: null; erro: string | null };

/** Plano da compra, ou por que ele não fecha (ex.: R$ 0,01 em 2× = menos de 1 centavo por parcela). */
export function avaliarParcelas(total: number, parcelas: number, dataPrimeira: string): AvaliacaoParcelas {
  if (!(total > 0) || !dataPrimeira) return { plano: null, erro: null };
  try {
    return { plano: dividirParcelas(total, parcelas, dataPrimeira), erro: null };
  } catch (e) {
    return { plano: null, erro: e instanceof Error && e.message ? e.message : MENSAGEM_TOTAL_VAZIO };
  }
}

/** Plano da compra ou `null` se o total ainda não fecha (vazio, zero, mais de 2 casas, menos de 1 centavo por parcela). */
export function planoParcelas(total: number, parcelas: number, dataPrimeira: string): ParcelaPlanejada[] | null {
  return avaliarParcelas(total, parcelas, dataPrimeira).plano;
}

/** "10× de R$ 12,34 (1ª R$ 12,40)"; parcelas iguais = só "3× de R$ 10,00". */
export function textoPrevia(plano: readonly ParcelaPlanejada[]): string {
  const [primeira, segunda] = plano;
  if (!primeira || !segunda) return '';
  const base = `${plano.length}× de ${formatBRL(segunda.valor)}`;
  return primeira.valor === segunda.valor ? base : `${base} (1ª ${formatBRL(primeira.valor)})`;
}

/** "20/03", ou "20/03/27" quando cai em outro ano. */
const dataCurta = (iso: string, ref: string) => (iso.slice(0, 4) === ref.slice(0, 4) ? formatDiaMes(iso) : `${formatDiaMes(iso)}/${iso.slice(2, 4)}`);

export interface CampoParceladoProps {
  ligado: boolean;
  onLigado: (ligado: boolean) => void;
  parcelas: number;
  onParcelas: (n: number) => void;
  /** Valor TOTAL da compra (o que a pessoa digitou em Valor). */
  total: number;
  /** Data da 1ª parcela (a data da compra). */
  dataPrimeira: string;
}

/**
 * "Parcelado no cartão" (só despesa nova): interruptor; ligado, escolhe de 2× a 24× e mostra a prévia da divisão
 * (centavos que sobram vão na 1ª). O valor digitado é o total; a 1ª cai na data escolhida e as outras todo mês.
 * Mesmo componente no "Gastei" e no "Novo lançamento".
 */
export function CampoParcelado({ ligado, onLigado, parcelas, onParcelas, total, dataPrimeira }: CampoParceladoProps) {
  const id = useId();
  const { plano, erro } = ligado ? avaliarParcelas(total, parcelas, dataPrimeira) : { plano: null, erro: null };
  const ultima = plano?.[plano.length - 1];
  return (
    <div className="rounded-xl border border-border bg-card2 px-3 py-1" data-testid="campo-parcelado">
      <button
        type="button"
        role="switch"
        aria-checked={ligado}
        onClick={() => onLigado(!ligado)}
        className="flex min-h-[44px] w-full items-center justify-between gap-3 text-left text-[15px] text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
      >
        <span>Parcelado no cartão</span>
        <span aria-hidden="true" className={clsx('relative h-6 w-10 shrink-0 rounded-full transition-colors motion-reduce:transition-none', ligado ? 'bg-accent' : 'bg-text/20')}>
          <span className={clsx('absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform motion-reduce:transition-none', ligado ? 'translate-x-[18px]' : 'translate-x-0.5')} />
        </span>
      </button>
      {ligado && (
        <div className="space-y-2 border-t border-border pb-2 pt-2">
          <div className="flex items-center justify-between gap-2">
            <span id={`${id}-rotulo`} className="text-[14px] text-muted">Parcelas</span>
            <div role="group" aria-labelledby={`${id}-rotulo`} className="flex items-center">
              <button
                type="button"
                aria-label="Menos uma parcela"
                disabled={parcelas <= PARCELAS_MIN}
                onClick={() => onParcelas(Math.max(PARCELAS_MIN, parcelas - 1))}
                className="flex h-11 w-11 items-center justify-center rounded-lg text-accent disabled:text-muted disabled:opacity-45"
              >
                <Minus size={16} aria-hidden="true" />
              </button>
              <output aria-live="polite" data-testid="parcelas-n" className="min-w-[3ch] text-center text-[16px] font-semibold tabular-nums text-text">
                {parcelas}×
              </output>
              <button
                type="button"
                aria-label="Mais uma parcela"
                disabled={parcelas >= PARCELAS_MAX}
                onClick={() => onParcelas(Math.min(PARCELAS_MAX, parcelas + 1))}
                className="flex h-11 w-11 items-center justify-center rounded-lg text-accent disabled:text-muted disabled:opacity-45"
              >
                <Plus size={16} aria-hidden="true" />
              </button>
            </div>
          </div>
          <p
            className={clsx('text-[14px] font-medium tabular-nums', erro ? 'text-red' : 'text-text')}
            data-testid="parcelas-previa"
            data-erro={erro ? 'true' : undefined}
            aria-live="polite"
          >
            {plano ? textoPrevia(plano) : (erro ?? MENSAGEM_TOTAL_VAZIO)}
          </p>
          <p className="text-[12.5px] leading-snug text-muted">
            {plano && ultima
              ? `O valor é o total. A 1ª cai em ${formatDiaMes(plano[0]!.data)} e a última em ${dataCurta(ultima.data, plano[0]!.data)}.`
              : 'O valor é o total. A 1ª cai na data da compra e as outras, todo mês.'}
          </p>
        </div>
      )}
    </div>
  );
}
