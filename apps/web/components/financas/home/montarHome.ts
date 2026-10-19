import type { Competencia, OcorrenciaConta, Transacao } from '@meudia/shared';
import { ultimasDespesas } from '@meudia/shared';
import { ordenarOcorrencias } from '../../../lib/financas-ui';
import type { ContaProxima } from './ProximasContas';

/** Campos de `resumoFinanceiroMes` usados pela Início. */
export interface ResumoHome {
  rendaPrevista: number;
  rendaReal: number;
}

export interface DadosHome {
  competencia: Competencia;
  hojeISO: string;
  resumo: ResumoHome;
  ocorrencias: readonly OcorrenciaConta[];
  transacoes: readonly Transacao[];
}

/** Início resumida (decisão 7): só o que cabe numa tela; o resto foi para Gastos › Análise. */
export interface SecoesHome {
  /** Sem renda prevista nem recebida: só o card de boas-vindas (sem "R$ 0,00"). */
  vazio: boolean;
  /** `null` = nenhuma conta no mês. */
  contasAVencer: { contas: ContaProxima[]; totalMes: number } | null;
  /** 3 despesas mais recentes do mês (sem ajustes). */
  ultimosGastos: Transacao[];
}

const MAX_CONTAS = 2;
const MAX_GASTOS = 3;

const paraContaProxima = (oc: OcorrenciaConta): ContaProxima => ({
  contaId: oc.conta.id,
  competencia: oc.competencia,
  descricao: oc.conta.descricao,
  valor: Number(oc.conta.valor),
  vencimento: oc.vencimento,
  situacao: oc.situacao,
  categoria: oc.conta.categoria,
});

/** Dados dos hooks → props das seções da Início (puro, sem React). */
export function montarHome({ competencia, resumo, ocorrencias, transacoes }: DadosHome): SecoesHome {
  // Vencidas primeiro (destacadas dentro do card, sem banner separado), depois por vencimento.
  const pendentes = ordenarOcorrencias(ocorrencias).filter((oc) => oc.situacao !== 'paga');
  return {
    vazio: resumo.rendaPrevista === 0 && resumo.rendaReal === 0,
    contasAVencer: ocorrencias.length
      ? { contas: pendentes.slice(0, MAX_CONTAS).map(paraContaProxima), totalMes: ocorrencias.length }
      : null,
    ultimosGastos: ultimasDespesas(transacoes, { mes: competencia }).dias.flatMap((d) => d.itens).slice(0, MAX_GASTOS),
  };
}
