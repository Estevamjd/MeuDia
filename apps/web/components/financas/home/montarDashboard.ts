import type { HistoricoSaldoMes, PainelSaldo } from '@meudia/api';
import type { Competencia, FatiaCategoria, PerguntaFechamento, PontoEvolucao, SobraDoMes, Transacao } from '@meudia/shared';
import { evolucaoMesComBase, gastosPorCategoria, perguntaFechamento, sobraDoMes } from '@meudia/shared';
import { partesCompetencia } from '../../../lib/financas-ui';
import type { CardSaldoHojeProps } from './CardSaldoHoje';
import type { RendaAReceberItem } from './CardRendaAReceber';

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

export interface DadosDashboard {
  saldo: Omit<CardSaldoHojeProps, 'escondido' | 'onAlternarOlho'>;
  /** `null` fora do mês corrente. */
  sobraMes: SobraDoMes | null;
  /** Dinheiro guardado (014); banco sem a 014: o total dos bancos, como antes. */
  cofrinho: number;
  /** "Sobrou R$ X em <mês>. Quer guardar no Cofrinho?" (uma vez por mês); `null` = nada a perguntar. */
  fechamento: PerguntaFechamento | null;
  rendasAReceber: RendaAReceberItem[];
  fatias: FatiaCategoria[];
  /** Gasto por dia sempre; `saldo` só com `historico` (sem ele, `null` em todos os dias). */
  evolucao: PontoEvolucao[];
}

/**
 * Evolução do mês: barras de gasto por dia; a linha de saldo só quando o `historico` (saldos de abertura + transferências
 * do mês) foi lido. Quem não desenha a linha (Início, Painel) não passa o histórico e recebe `saldo: null`.
 */
function evolucao(
  competencia: Competencia, hojeISO: string, transacoesMes: readonly Transacao[],
  carteiras: PainelSaldo['arquivadas'], historico: HistoricoSaldoMes | undefined,
): PontoEvolucao[] {
  if (historico) return evolucaoMesComBase(competencia, hojeISO, transacoesMes, carteiras, historico.bases, historico.transferencias);
  return evolucaoMesComBase(competencia, hojeISO, transacoesMes, [], {}, []);
}

/** Painel de saldo + lançamentos do mês exibido → dados dos cards e gráficos (puro, sem React). */
export function montarDashboard(
  competencia: Competencia, hojeISO: string, painel: PainelSaldo, transacoesMes: readonly Transacao[], historico?: HistoricoSaldoMes,
): DadosDashboard {
  const mesCorrente = competencia === painel.competencia;
  const todas = [...painel.carteiras.map((s) => s.carteira), ...painel.arquivadas];
  // `transacoesMes` é da competência exibida: só no mês corrente ela casa com as entradas do painel.
  const sobra = mesCorrente ? sobraDoMes({ competencia: painel.competencia, transacoes: transacoesMes, ...painel.mes }) : null;
  const fechamento = mesCorrente && painel.cofrinho
    ? perguntaFechamento({
        hojeISO: painel.hojeISO,
        inicioCofrinho: painel.cofrinho.inicioEm,
        respondidas: painel.cofrinho.respondidas,
        sobraDe: (c) => (c === painel.competencia ? sobra?.valor ?? null : c === painel.mesAnterior.competencia ? painel.mesAnterior.sobra : null),
      })
    : null;
  return {
    saldo: {
      total: painel.saldoHoje,
      carteiras: painel.carteiras.map(({ carteira, saldo }) => ({ id: carteira.id, nome: carteira.nome, saldo, noTotal: carteira.incluir_no_total })),
      comecouMes: mesCorrente ? painel.comecouMes : null,
      nomeMes: MESES[partesCompetencia(painel.competencia).mes - 1]!,
    },
    sobraMes: sobra,
    cofrinho: painel.cofrinho?.saldo ?? painel.saldoHoje,
    fechamento,
    rendasAReceber: mesCorrente
      ? painel.rendasAReceber.map((r) => ({ rendaId: r.renda.id, descricao: r.renda.descricao, valor: Number(r.renda.valor), data: r.data, competencia: r.competencia }))
      : [],
    fatias: gastosPorCategoria(transacoesMes),
    evolucao: evolucao(competencia, hojeISO, transacoesMes, todas, historico),
  };
}
