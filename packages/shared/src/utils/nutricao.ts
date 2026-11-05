import type { ItemRefeicao, Refeicao } from '../types/dieta';

/**
 * Nutrição sem valor inventado (BRIEF §3.4, design-system B §6): "NA", "Tr", "*" e célula vazia da TACO
 * viram null ("sem valor"), nunca 0. Um 0 escrito na tabela continua 0.
 */

const SEM_VALOR_TACO = new Set(['', 'NA', 'TR', '*']);

/** Célula da TACO → número ou null. Texto que não é número nem marcador conhecido para com erro (não adivinha). */
export function lerCelulaTaco(celula: string | number | null | undefined): number | null {
  if (celula === null || celula === undefined) return null;
  if (typeof celula === 'number') return Number.isFinite(celula) ? celula : null;
  const t = celula.trim();
  if (SEM_VALOR_TACO.has(t.toUpperCase())) return null;
  const n = Number(t.replace(',', '.'));
  if (!Number.isFinite(n) || !/^-?\d+([.,]\d+)?$/.test(t)) throw new Error(`Valor da TACO não reconhecido: "${t}"`);
  return n;
}

/** Valor de um nutriente do item: número finito ≥ 0 ou null (sem valor). */
export function valorNutriente(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : null;
}

export interface TotalNutriente {
  /** Soma só dos itens com valor. */
  total: number;
  /** Itens sem valor nesse nutriente (não entram no total). */
  semValor: number;
  /** Algum item tem valor. Sem nenhum, a tela mostra "sem valor" e não 0. */
  temValor: boolean;
}

type Campo = 'calorias' | 'proteina' | 'carbo' | 'gordura';

export function totalNutriente(itens: readonly ItemRefeicao[], campo: Campo): TotalNutriente {
  return itens.reduce<TotalNutriente>(
    (acc, item) => {
      const v = valorNutriente(item[campo]);
      return v === null
        ? { ...acc, semValor: acc.semValor + 1 }
        : { total: acc.total + v, semValor: acc.semValor, temValor: true };
    },
    { total: 0, semValor: 0, temValor: false },
  );
}

export interface TotalRefeicao {
  /** null = nenhum item com kcal ("sem valor"). */
  kcal: number | null;
  proteina: number | null;
  /** Itens sem kcal: o total é parcial quando > 0 e há outros com valor. */
  itensSemValor: number;
}

/** Totais da refeição pelos itens. Linha antiga sem itens usa as colunas total_*. */
export function totalRefeicao(r: Pick<Refeicao, 'items' | 'total_calorias' | 'total_proteina'>): TotalRefeicao {
  const itens = Array.isArray(r.items) ? r.items : [];
  if (itens.length === 0) {
    return { kcal: valorNutriente(Number(r.total_calorias)), proteina: valorNutriente(Number(r.total_proteina)), itensSemValor: 0 };
  }
  const kcal = totalNutriente(itens, 'calorias');
  const prot = totalNutriente(itens, 'proteina');
  return {
    kcal: kcal.temValor ? Math.round(kcal.total) : null,
    proteina: prot.temValor ? Math.round(prot.total * 10) / 10 : null,
    itensSemValor: kcal.semValor,
  };
}

export interface TotalDia {
  kcal: number;
  proteina: number;
  /** Itens sem kcal somados no dia (a tela avisa que o total não conta com eles). */
  itensSemValor: number;
}

export function totalDia(refeicoes: readonly Pick<Refeicao, 'items' | 'total_calorias' | 'total_proteina'>[]): TotalDia {
  return refeicoes.reduce<TotalDia>(
    (acc, r) => {
      const t = totalRefeicao(r);
      return {
        kcal: acc.kcal + (t.kcal ?? 0),
        proteina: Math.round((acc.proteina + (t.proteina ?? 0)) * 10) / 10,
        itensSemValor: acc.itensSemValor + t.itensSemValor,
      };
    },
    { kcal: 0, proteina: 0, itensSemValor: 0 },
  );
}

export interface ProgressoCalorias {
  /** % inteiro da meta (pode passar de 100). */
  pct: number;
  /** Meta do dia cumprida = 100% ou mais (BRIEF §3.7). */
  cumprida: boolean;
  acimaKcal: number;
  /** Fração da barra até a marca da meta (verde quando cumprida, accent3 antes). */
  barraAteMeta: number;
  /** Fração da barra do excedente (verde-escuro). 0 até 100%. */
  barraExcedente: number;
}

/** 1.930/3.102 → 62%, barra 0,62. 3.300/3.102 → 106%, 198 acima, barra 94% + 6%. Nunca alerta de excesso. */
export function progressoCalorias(consumido: number, meta: number): ProgressoCalorias {
  if (!(meta > 0)) return { pct: 0, cumprida: false, acimaKcal: 0, barraAteMeta: 0, barraExcedente: 0 };
  const c = Math.max(0, consumido);
  const cumprida = c >= meta;
  if (!cumprida) return { pct: Math.round((c / meta) * 100), cumprida, acimaKcal: 0, barraAteMeta: c / meta, barraExcedente: 0 };
  const ateMeta = meta / c;
  return {
    pct: Math.round((c / meta) * 100),
    cumprida,
    acimaKcal: Math.round(c - meta),
    barraAteMeta: ateMeta,
    barraExcedente: 1 - ateMeta,
  };
}

/** "ref. TACO" só quando todos os itens vieram da TACO; o resto é "fora da TACO". */
export function seloRefeicao(itens: readonly ItemRefeicao[]): 'taco' | 'fora' {
  return itens.length > 0 && itens.every((i) => i.fonte === 'taco') ? 'taco' : 'fora';
}
