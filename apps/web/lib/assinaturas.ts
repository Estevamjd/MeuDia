import type { OcorrenciaConta, SituacaoOcorrencia } from '@meudia/shared';
import { diasAte, proximoVencimento } from '@meudia/shared';

/** Inclui a que vence hoje e respeita a virada do mês/ano. */
export function isVencendoEstaSemana(diaVencimento: number, hojeISO: string): boolean {
  return diasAte(proximoVencimento(diaVencimento, hojeISO), hojeISO) <= 7;
}

/** Situação da conta espelhada (`contas_pagar.assinatura_id`) de cada assinatura na competência. */
export function situacaoPorAssinatura(ocorrencias: OcorrenciaConta[]): Map<string, SituacaoOcorrencia> {
  const mapa = new Map<string, SituacaoOcorrencia>();
  for (const o of ocorrencias) {
    if (o.conta.assinatura_id) mapa.set(o.conta.assinatura_id, o.situacao);
  }
  return mapa;
}
