import type { Competencia, OcorrenciaConta, OrcamentoCategoria, Selo, Transacao } from '@meudia/shared';
import { linhasOrcamento, ordenarOcorrencias, referenciaMesAnterior, textoDelta } from '../../../lib/financas-ui';
import type { AlertaContasProps } from './AlertaContas';
import type { EntradasSaidasProps } from './EntradasSaidas';
import type { HeroSobraProps } from './HeroSobra';
import type { IndicadoresMesProps } from './IndicadoresMes';
import type { OrcamentoResumoProps } from './OrcamentoResumo';
import type { ContaProxima } from './ProximasContas';

/** Campos de `resumoFinanceiroMes` usados pela home. */
export interface ResumoHome {
  rendaPrevista: number;
  rendaReal: number;
  /** R11: receitas lançadas + rendas fixas sem "Recebi" (ausente em resumos antigos). */
  rendaDoMes?: number;
  gastoReal: number;
  gastoPrevisto: number;
  sobraPrevista: number;
  sobraReal: number;
  pctComprometida: number | null;
  pagasNoPrazo: number | null;
  vsMesAnterior: { gastoReal: { absoluto: number; percentual: number | null } };
  selo: Selo | null;
}

export interface DadosHome {
  competencia: Competencia;
  hojeISO: string;
  resumo: ResumoHome;
  ocorrencias: readonly OcorrenciaConta[];
  orcamento: readonly OrcamentoCategoria[];
  transacoes: readonly Transacao[];
}

export interface SecoesHome {
  /** Sem renda prevista nem recebida: só o card de boas-vindas (sem "R$ 0,00"). */
  vazio: boolean;
  hero: HeroSobraProps;
  entradasSaidas: EntradasSaidasProps;
  alerta: Omit<AlertaContasProps, 'hojeISO'> | null;
  proximasContas: { contas: ContaProxima[]; totalMes: number } | null;
  orcamento: OrcamentoResumoProps | null;
  indicadores: IndicadoresMesProps;
  transacoes: Transacao[];
}

const MAX_ITENS = 3;

const paraContaProxima = (oc: OcorrenciaConta): ContaProxima => ({
  contaId: oc.conta.id,
  competencia: oc.competencia,
  descricao: oc.conta.descricao,
  valor: Number(oc.conta.valor),
  vencimento: oc.vencimento,
  situacao: oc.situacao,
  categoria: oc.conta.categoria,
});

/** Dados dos hooks → props das seções da home (puro, sem React). */
export function montarHome({ competencia, hojeISO, resumo, ocorrencias, orcamento, transacoes }: DadosHome): SecoesHome {
  const pendentes = ordenarOcorrencias(ocorrencias).filter((oc) => oc.situacao !== 'paga');
  const urgentes = pendentes.filter((oc) => oc.situacao === 'vencida' || oc.vencimento === hojeISO);
  const textoGasto = textoDelta(resumo.vsMesAnterior.gastoReal, referenciaMesAnterior(competencia));
  const categorias = linhasOrcamento(orcamento, transacoes)
    .flatMap((l) => (l.limite === null ? [] : [{ categoria: l.categoria, gasto: l.gasto, limite: l.limite }]))
    .slice(0, MAX_ITENS);

  return {
    vazio: resumo.rendaPrevista === 0 && resumo.rendaReal === 0,
    hero: {
      sobraReal: resumo.sobraReal,
      sobraPrevista: resumo.sobraPrevista,
      selo: resumo.selo,
      gastoReal: resumo.gastoReal,
      // Mesma base da sobra (R11): a entrada extra soma, não substitui a renda fixa.
      rendaBase: resumo.rendaDoMes ?? (resumo.rendaReal || resumo.rendaPrevista),
    },
    entradasSaidas: {
      rendaReal: resumo.rendaReal,
      rendaPrevista: resumo.rendaPrevista,
      gastoReal: resumo.gastoReal,
      gastoPrevisto: resumo.gastoPrevisto,
      comparativoGasto: textoGasto ? { texto: textoGasto, aumentou: resumo.vsMesAnterior.gastoReal.absoluto > 0 } : null,
    },
    alerta: urgentes.length
      ? {
          contas: urgentes.map((oc) => ({ id: oc.conta.id, descricao: oc.conta.descricao, vencimento: oc.vencimento })),
          href: '#proximas-contas',
        }
      : null,
    proximasContas: ocorrencias.length
      ? { contas: pendentes.slice(0, MAX_ITENS).map(paraContaProxima), totalMes: ocorrencias.length }
      : null,
    orcamento: categorias.length ? { categorias } : null,
    indicadores: { pctComprometida: resumo.pctComprometida, pagasNoPrazo: resumo.pagasNoPrazo },
    transacoes: [...transacoes].sort(
      (a, b) => b.data.localeCompare(a.data) || (b.created_at ?? '').localeCompare(a.created_at ?? ''),
    ),
  };
}
