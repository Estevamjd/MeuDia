import type { Competencia, EntradasDoMes } from '@meudia/shared';
import { referenciaMesAnterior, textoDelta } from '../../../lib/financas-ui';

/** Campos de `resumoFinanceiroMes` usados pela Análise (DIAG-CARD-ENTROU §5). */
export interface ResumoAnalise {
  rendaPrevista: number;
  /** Salário (recebido ou ainda a receber) + extras: a mesma base do "No fim do mês sobra". */
  rendaDoMes: number;
  gastoReal: number;
  entradas: EntradasDoMes;
  contasMes: number;
  contasPagas: number;
  contasFaltam: number;
  pctComprometida: number | null;
  pagasNoPrazo: number | null;
  /** `null` = mês anterior sem lançamento: nada de comparação falsa. */
  vsMesAnterior: { gastoReal: { absoluto: number; percentual: number | null } } | null;
}

export interface Analise {
  entradas: EntradasDoMes;
  saiu: { gasto: number; contasMes: number; contasPagas: number; contasFaltam: number };
  /** `null` quando o mês anterior não tem dados ("Primeiro mês no app") ou o gasto não mudou. */
  comparacao: { texto: string; aumentou: boolean } | null;
  primeiroMes: boolean;
  /** Gasto ÷ renda do mês (salário + extras). */
  pctRendaUsada: number | null;
  /** Contas do mês ÷ salário (ex-"renda comprometida"). */
  pctContasFixas: number | null;
  pagasEmDia: number | null;
}

/** Resumo do mês → números da Análise, cada percentual com a base explícita (puro, sem React). */
export function montarAnalise(r: ResumoAnalise, competencia: Competencia): Analise {
  const delta = r.vsMesAnterior?.gastoReal;
  const texto = delta ? textoDelta(delta, referenciaMesAnterior(competencia)) : null;
  return {
    entradas: r.entradas,
    saiu: { gasto: r.gastoReal, contasMes: r.contasMes, contasPagas: r.contasPagas, contasFaltam: r.contasFaltam },
    comparacao: texto && delta ? { texto: `Saiu ${texto}`, aumentou: delta.absoluto > 0 } : null,
    primeiroMes: r.vsMesAnterior === null,
    pctRendaUsada: r.rendaDoMes > 0 ? r.gastoReal / r.rendaDoMes : null,
    pctContasFixas: r.pctComprometida,
    pagasEmDia: r.pagasNoPrazo,
  };
}
