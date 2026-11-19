import type { Competencia, MovimentoCofrinho } from '../types/financas';
import { competenciaDe, hojeSP } from './vencimentos';
import { fimDoMes, somarDias } from './saldo';

/**
 * Cofrinho = dinheiro já guardado (014). Gasto não mexe aqui: só "Guardar", "Tirar", "Corrigir" e guardar a sobra
 * do mês. O ponto de partida ("inicial") é o Cofrinho de antes da 014, congelado na migração.
 */

const centavos = (n: number) => Math.round(n * 100) / 100 + 0;

export function saldoCofrinho(movimentos: readonly Pick<MovimentoCofrinho, 'valor'>[]): number {
  return centavos(movimentos.reduce((s, m) => s + Number(m.valor), 0));
}

/** Competência anterior a `yyyy-MM`. */
export function competenciaAnterior(competencia: Competencia): Competencia {
  return competenciaDe(somarDias(`${competencia}-01`, -1));
}

export interface EntradaPerguntaFechamento {
  hojeISO: string;
  /** Quando o Cofrinho começou (`created_at` do "inicial", ISO); `null` = ainda não começou. */
  inicioCofrinho: string | null;
  /** Competências já respondidas ("Guardar" ou "Agora não"). */
  respondidas: readonly Competencia[];
  /** "Deve sobrar" de cada competência candidata (mês anterior e o atual); `null` = sem dados. */
  sobraDe: (competencia: Competencia) => number | null;
}

export interface PerguntaFechamento {
  competencia: Competencia;
  valor: number;
}

/**
 * "Sobrou R$ X em <mês>. Quer guardar no Cofrinho?": uma vez por mês, no primeiro acesso do mês seguinte
 * ou já no último dia do mês. Nunca pergunta de meses anteriores ao começo do Cofrinho, nem se não sobrou nada.
 */
export function perguntaFechamento({ hojeISO, inicioCofrinho, respondidas, sobraDe }: EntradaPerguntaFechamento): PerguntaFechamento | null {
  const atual = competenciaDe(hojeISO);
  const primeira = inicioCofrinho ? competenciaDe(hojeSP(new Date(inicioCofrinho))) : atual;
  const candidatas = [competenciaAnterior(atual), ...(hojeISO === fimDoMes(atual) ? [atual] : [])];
  for (const competencia of candidatas) {
    if (competencia < primeira || respondidas.includes(competencia)) continue;
    const valor = sobraDe(competencia);
    if (valor !== null && centavos(valor) > 0) return { competencia, valor: centavos(valor) };
  }
  return null;
}
