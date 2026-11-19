import type { Competencia, FatiaCategoria, SobraDoMes, Transacao } from '@meudia/shared';
import { competenciaDe, gastosPorCategoria } from '@meudia/shared';

export type SituacaoMes = 'no-controle' | 'atencao' | 'passou';

export interface CategoriaResumo extends FatiaCategoria {
  /** % do total gasto no mês (0–100, inteiro). */
  pct: number;
}

/** Tudo o que a Início e o Relatório mostram do mês, a partir de dados reais (puro, sem React). */
export interface ResumoMes {
  /** Receitas lançadas no mês (sem ajustes de saldo). */
  entrou: number;
  /** Rendas fixas do mês ainda sem "Recebi" (só no mês corrente com banco). */
  aReceber: number;
  /** Despesas lançadas no mês (sem ajustes de saldo). */
  saiu: number;
  /** Renda do mês − gastos já lançados (mesma regra do card antigo "Sobra do mês"). */
  sobra: number;
  /** "No fim do mês sobra": desconta também as contas ainda não pagas. `null` sem painel de saldo. */
  prevista: number | null;
  /** Próxima conta a pagar do mês, para a dica da prevista. */
  proximaConta: { descricao: string; vencimento: string } | null;
  /** Renda do mês (lançada + a receber). */
  renda: number;
  /** % da renda já usada pelos gastos lançados; `null` sem renda. */
  pctUsado: number | null;
  situacao: SituacaoMes | null;
  categorias: CategoriaResumo[];
  ultimos: Transacao[];
  quantidade: { total: number; whatsapp: number };
  vazio: boolean;
}

const centavos = (n: number) => Math.round(n * 100) / 100 || 0;
const MAX_ULTIMOS = 5;

export function situacaoDo(pctProjetado: number | null, prevista: number | null): SituacaoMes | null {
  if (pctProjetado === null) return null;
  if ((prevista !== null && prevista < 0) || pctProjetado > 100) return 'passou';
  return pctProjetado > 85 ? 'atencao' : 'no-controle';
}

export function montarResumoMes(competencia: Competencia, transacoes: readonly Transacao[], sobraMes: SobraDoMes | null): ResumoMes {
  const doMes = transacoes.filter((t) => !t.ajuste && competenciaDe(t.data) === competencia);
  const entrou = centavos(doMes.filter((t) => t.tipo === 'receita').reduce((s, t) => s + Number(t.valor), 0));
  const saiu = centavos(doMes.filter((t) => t.tipo === 'despesa').reduce((s, t) => s + Number(t.valor), 0));
  const aReceber = sobraMes ? centavos(sobraMes.rendasAReceber.reduce((s, r) => s + r.valor, 0)) : 0;
  const renda = sobraMes ? sobraMes.renda.total : entrou;
  const despesasLancadas = sobraMes ? sobraMes.despesasLancadas : saiu;
  const sobra = centavos(renda - despesasLancadas);
  const prevista = sobraMes ? sobraMes.valor : null;
  const pctUsado = renda > 0 ? Math.round((despesasLancadas / renda) * 100) : null;
  const pctProjetado = renda > 0 ? Math.round(((sobraMes ? sobraMes.despesas : saiu) / renda) * 100) : null;
  const total = gastosPorCategoria(doMes, 5);
  const categorias = total.map((f) => ({ ...f, pct: saiu > 0 ? Math.round((f.valor / saiu) * 100) : 0 }));
  const ultimos = [...doMes]
    .sort((a, b) => b.data.localeCompare(a.data) || (b.created_at ?? '').localeCompare(a.created_at ?? ''))
    .slice(0, MAX_ULTIMOS);
  const proxima = sobraMes?.contasAPagar[0];
  return {
    entrou,
    aReceber,
    saiu,
    sobra,
    prevista,
    proximaConta: proxima ? { descricao: proxima.descricao, vencimento: proxima.vencimento } : null,
    renda,
    pctUsado,
    situacao: situacaoDo(pctProjetado, prevista),
    categorias,
    ultimos,
    quantidade: { total: doMes.length, whatsapp: doMes.filter((t) => t.origem === 'whatsapp').length },
    vazio: doMes.length === 0 && renda === 0,
  };
}
