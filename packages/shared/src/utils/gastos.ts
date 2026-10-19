import type { Competencia, Renda, RecebimentoRenda, Transacao } from '../types/financas';
import { competenciaDe, hojeSP } from './vencimentos';

/** Cálculo puro da aba Gastos: Entrou (salário × extras), pagas em dia e Últimas despesas. */

const centavos = (n: number) => Math.round(n * 100) / 100 + 0;

export interface EntradasDoMes {
  /** Receitas do mês ligadas a um "Recebi" (`recebimentos_renda.transacao_id`). */
  salarioRecebido: number;
  /** Rendas fixas ativas (o "de R$ Y" do salário). */
  salarioPrevisto: number;
  /** Receitas do mês sem vínculo com renda (Pix, freela, presente). Ajustes ficam fora. */
  extras: number;
  /** salarioRecebido + extras: o que de fato entrou. */
  total: number;
}

/** DIAG §5.1: "Salário: recebido X de Y" separado de "Extras: Z". `transacoes` já são as do mês. */
export function entradasDoMes(
  transacoes: readonly Pick<Transacao, 'id' | 'tipo' | 'valor' | 'ajuste'>[],
  rendas: readonly Pick<Renda, 'valor' | 'ativo'>[],
  recebimentos: readonly Pick<RecebimentoRenda, 'transacao_id'>[],
): EntradasDoMes {
  const doSalario = new Set(recebimentos.flatMap((r) => (r.transacao_id ? [r.transacao_id] : [])));
  let salarioRecebido = 0;
  let extras = 0;
  for (const t of transacoes) {
    if (t.tipo !== 'receita' || t.ajuste) continue;
    if (doSalario.has(t.id)) salarioRecebido += Number(t.valor);
    else extras += Number(t.valor);
  }
  const salarioPrevisto = rendas.filter((r) => r.ativo).reduce((s, r) => s + Number(r.valor), 0);
  return {
    salarioRecebido: centavos(salarioRecebido),
    salarioPrevisto: centavos(salarioPrevisto),
    extras: centavos(extras),
    total: centavos(salarioRecebido + extras),
  };
}

interface OcorrenciaPrazo {
  vencimento: string;
  conta: { created_at: string | null };
  pagamento: { pago_em: string } | null;
}

/**
 * DIAG §5.5: fração das contas vencidas até hoje pagas até o vencimento, só entre as elegíveis: vencimento ≥ dia (SP)
 * em que a conta foi cadastrada e ≥ a âncora mais antiga das carteiras (se houver). Sem elegíveis → `null` ("—").
 */
export function pagasEmDia(ocorrencias: readonly OcorrenciaPrazo[], hojeISO: string, ancorasCarteiras: readonly string[]): number | null {
  const ancora = ancorasCarteiras.map((a) => hojeSP(new Date(a))).sort()[0];
  const elegiveis = ocorrencias.filter((oc) => {
    if (oc.vencimento > hojeISO) return false;
    if (oc.conta.created_at && oc.vencimento < hojeSP(new Date(oc.conta.created_at))) return false;
    return !ancora || oc.vencimento >= ancora;
  });
  if (!elegiveis.length) return null;
  return elegiveis.filter((oc) => oc.pagamento && oc.pagamento.pago_em <= oc.vencimento).length / elegiveis.length;
}

export interface FiltroDespesas {
  mes: Competencia;
  categoria?: string | null;
}

export interface DiaDeDespesas<T> {
  data: string;
  itens: T[];
  total: number;
}

export interface UltimasDespesas<T> {
  dias: DiaDeDespesas<T>[];
  total: number;
  quantidade: number;
  /** Categorias com despesa no mês (para o filtro), em ordem alfabética. */
  categorias: string[];
}

type Despesa = Pick<Transacao, 'tipo' | 'valor' | 'data' | 'categoria' | 'ajuste' | 'created_at'>;

/** Despesas do mês (sem ajustes), mais recentes primeiro (data e depois criação), agrupadas por dia. */
export function ultimasDespesas<T extends Despesa>(transacoes: readonly T[], { mes, categoria }: FiltroDespesas): UltimasDespesas<T> {
  const doMes = transacoes.filter((t) => t.tipo === 'despesa' && !t.ajuste && competenciaDe(t.data) === mes);
  const filtradas = doMes
    .filter((t) => !categoria || t.categoria === categoria)
    .sort((a, b) => b.data.localeCompare(a.data) || (b.created_at ?? '').localeCompare(a.created_at ?? ''));
  const dias: DiaDeDespesas<T>[] = [];
  for (const t of filtradas) {
    const dia = dias.at(-1)?.data === t.data ? dias.at(-1)! : (dias[dias.length] = { data: t.data, itens: [], total: 0 });
    dia.itens.push(t);
    dia.total = centavos(dia.total + Number(t.valor));
  }
  return {
    dias,
    total: centavos(filtradas.reduce((s, t) => s + Number(t.valor), 0)),
    quantidade: filtradas.length,
    categorias: [...new Set(doMes.map((t) => t.categoria))].sort((a, b) => a.localeCompare(b, 'pt-BR')),
  };
}
