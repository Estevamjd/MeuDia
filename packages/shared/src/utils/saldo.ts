import type {
  Carteira,
  ContaPagar,
  PagamentoConta,
  RecebimentoRenda,
  Renda,
  Transacao,
  Transferencia,
} from '../types/financas';
import { CATEGORIA_OUTROS } from '../constants/categorias';
import { ocorrenciaDaConta } from './ocorrencia-conta';
import { competenciaDe, hojeSP, vencimentoNoMes } from './vencimentos';

/**
 * Cálculo puro (sem I/O) de saldo, previsão e renda do mês (BRIEF R2, R3, R10, R11, R12).
 * Datas em `yyyy-MM-dd` no calendário de America/Sao_Paulo; instantes em ISO 8601.
 */

const centavos = (n: number) => Math.round(n * 100) / 100 + 0;

type Movimento = { data: string; created_at?: string | null };
type TransacaoSaldo = Pick<Transacao, 'tipo' | 'valor' | 'data' | 'created_at' | 'carteira_id'>;
type TransacaoMes = Pick<Transacao, 'tipo' | 'valor' | 'data' | 'categoria' | 'ajuste'>;
type TransferenciaSaldo = Pick<Transferencia, 'origem_id' | 'destino_id' | 'valor' | 'data' | 'created_at'>;

/** Soma `n` dias a uma data `yyyy-MM-dd` (sem fuso). */
export function somarDias(dataISO: string, n: number): string {
  const [a, m, d] = dataISO.split('-').map(Number) as [number, number, number];
  return new Date(Date.UTC(a, m - 1, d + n)).toISOString().slice(0, 10);
}

/** Último dia do mês da data/competência informada. */
export function fimDoMes(dataOuCompetencia: string): string {
  const [a, m] = dataOuCompetencia.split('-').map(Number) as [number, number];
  return vencimentoNoMes(31, a, m);
}

function proximaCompetencia(competencia: string): string {
  const [a, m] = competencia.split('-').map(Number) as [number, number];
  return m === 12 ? `${String(a + 1).padStart(4, '0')}-01` : `${String(a).padStart(4, '0')}-${String(m + 1).padStart(2, '0')}`;
}

/** Competências de `de` até `ate` (inclusive). */
export function competenciasEntre(de: string, ate: string): string[] {
  const out: string[] = [];
  for (let c = de; c <= ate; c = proximaCompetencia(c)) out.push(c);
  return out;
}

/** Dia (SP) da âncora do saldo informado. */
export function dataAncora(carteira: Pick<Carteira, 'saldo_inicial_em'>): string {
  return hojeSP(new Date(carteira.saldo_inicial_em));
}

/**
 * R2: só conta o que veio depois da âncora — `data > dia da âncora`, ou no mesmo dia com
 * `created_at` posterior ao instante da âncora (sem `created_at` no mesmo dia: não conta).
 */
export function entraNoSaldo(carteira: Pick<Carteira, 'saldo_inicial_em'>, mov: Movimento): boolean {
  const dia = dataAncora(carteira);
  if (mov.data !== dia) return mov.data > dia;
  return !!mov.created_at && Date.parse(mov.created_at) > Date.parse(carteira.saldo_inicial_em);
}

/**
 * R2: saldo_inicial + receitas − despesas (ajustes incluídos) + transferências recebidas − enviadas.
 * `ate` (opcional) limita aos movimentos com data ≤ `ate` (fim de um dia em SP).
 */
export function saldoCarteira(
  carteira: Pick<Carteira, 'id' | 'saldo_inicial' | 'saldo_inicial_em'>,
  transacoes: readonly TransacaoSaldo[],
  transferencias: readonly TransferenciaSaldo[],
  ate?: string,
): number {
  const conta = (mov: Movimento) => (ate === undefined || mov.data <= ate) && entraNoSaldo(carteira, mov);
  let saldo = Number(carteira.saldo_inicial);
  for (const t of transacoes) {
    if (t.carteira_id !== carteira.id || !conta(t)) continue;
    saldo += t.tipo === 'receita' ? Number(t.valor) : -Number(t.valor);
  }
  for (const tr of transferencias) {
    if (!conta(tr)) continue;
    if (tr.destino_id === carteira.id) saldo += Number(tr.valor);
    if (tr.origem_id === carteira.id) saldo -= Number(tr.valor);
  }
  return centavos(saldo);
}

export interface SaldoDaCarteira {
  carteira: Carteira;
  saldo: number;
}

/** Saldo de cada carteira ativa (arquivadas saem dos chips e seletores), na ordem de exibição. */
export function saldosCarteiras(
  carteiras: readonly Carteira[],
  transacoes: readonly TransacaoSaldo[],
  transferencias: readonly TransferenciaSaldo[],
): SaldoDaCarteira[] {
  return carteiras
    .filter((c) => !c.arquivada)
    .sort((a, b) => a.ordem - b.ordem || (a.created_at ?? '').localeCompare(b.created_at ?? ''))
    .map((carteira) => ({ carteira, saldo: saldoCarteira(carteira, transacoes, transferencias) }));
}

/** R3: soma das carteiras ativas marcadas "somar no total". */
export function saldoHoje(
  carteiras: readonly Carteira[],
  transacoes: readonly TransacaoSaldo[],
  transferencias: readonly TransferenciaSaldo[],
): number {
  return centavos(
    saldosCarteiras(carteiras, transacoes, transferencias)
      .filter((s) => s.carteira.incluir_no_total)
      .reduce((soma, s) => soma + s.saldo, 0),
  );
}

/** A renda existe na competência? Rendas sem `created_at` (legado) valem em qualquer mês. */
function rendaVigente(renda: Pick<Renda, 'ativo' | 'created_at'>, competencia: string): boolean {
  return renda.ativo && (!renda.created_at || competenciaDe(hojeSP(new Date(renda.created_at))) <= competencia);
}

/** Dia previsto da renda na competência; sem dia cadastrado, conta no último dia do mês. */
export function dataRendaNoMes(renda: Pick<Renda, 'dia_recebimento'>, competencia: string): string {
  const [a, m] = competencia.split('-').map(Number) as [number, number];
  return vencimentoNoMes(renda.dia_recebimento ?? 31, a, m);
}

export interface ItemPrevisao {
  tipo: 'renda' | 'conta';
  id: string;
  descricao: string;
  categoria: string;
  /** Positivo para renda a receber, negativo para conta a pagar. */
  valor: number;
  data: string;
  competencia: string;
  vencida: boolean;
}

export interface EntradaPrevisao {
  hojeISO: string;
  alvoISO: string;
  saldoHoje: number;
  rendas: readonly Renda[];
  recebimentos: readonly Pick<RecebimentoRenda, 'renda_id' | 'competencia'>[];
  contas: readonly ContaPagar[];
  pagamentos: readonly Pick<PagamentoConta, 'conta_id' | 'competencia'>[];
}

export interface Previsao {
  alvoISO: string;
  saldoHoje: number;
  valor: number;
  itens: ItemPrevisao[];
}

/**
 * R10: saldo de hoje + rendas ativas ainda não recebidas com dia ≤ alvo − ocorrências de contas
 * não pagas (vencidas inclusive) com vencimento ≤ alvo, do mês corrente até o mês do alvo.
 * Limites de orçamento não entram. Meses anteriores ao corrente ficam de fora (pendência antiga
 * sem "Paguei" não deve puxar a previsão para sempre).
 */
export function previsao({ hojeISO, alvoISO, saldoHoje: hoje, rendas, recebimentos, contas, pagamentos }: EntradaPrevisao): Previsao {
  const recebidas = new Set(recebimentos.map((r) => `${r.renda_id}|${r.competencia}`));
  const pagas = new Set(pagamentos.map((p) => `${p.conta_id}|${p.competencia}`));
  const itens: ItemPrevisao[] = [];
  for (const competencia of competenciasEntre(competenciaDe(hojeISO), competenciaDe(alvoISO))) {
    for (const renda of rendas) {
      if (!rendaVigente(renda, competencia) || recebidas.has(`${renda.id}|${competencia}`)) continue;
      const data = dataRendaNoMes(renda, competencia);
      if (data > alvoISO) continue;
      itens.push({
        tipo: 'renda', id: renda.id, descricao: renda.descricao, categoria: 'Salário', valor: Number(renda.valor),
        data, competencia, vencida: data < hojeISO,
      });
    }
    for (const conta of contas) {
      const ocorrencia = ocorrenciaDaConta(conta, competencia);
      if (!ocorrencia || ocorrencia.vencimento > alvoISO || pagas.has(`${conta.id}|${competencia}`)) continue;
      itens.push({
        tipo: 'conta', id: conta.id, descricao: conta.descricao, categoria: conta.categoria, valor: -Number(conta.valor),
        data: ocorrencia.vencimento, competencia, vencida: ocorrencia.vencimento < hojeISO,
      });
    }
  }
  itens.sort((a, b) => a.data.localeCompare(b.data) || b.valor - a.valor);
  return { alvoISO, saldoHoje: hoje, valor: centavos(hoje + itens.reduce((s, i) => s + i.valor, 0)), itens };
}

/** Datas-alvo da home: hoje + 7 dias e o último dia do mês corrente. */
export function alvosPrevisao(hojeISO: string): { seteDias: string; fimDoMes: string } {
  return { seteDias: somarDias(hojeISO, 7), fimDoMes: fimDoMes(hojeISO) };
}

export interface RendaDoMes {
  /** Receitas lançadas na competência (sem ajustes). */
  lancada: number;
  /** Rendas fixas ativas ainda sem "Recebi" na competência. */
  aReceber: number;
  total: number;
}

/**
 * R11: renda do mês = receitas lançadas não-ajuste + rendas fixas ativas sem recebimento na competência.
 * Receita avulsa soma por cima da renda prevista, nunca a substitui.
 */
export function rendaDoMes(
  competencia: string,
  transacoes: readonly Pick<Transacao, 'tipo' | 'valor' | 'ajuste'>[],
  rendas: readonly Pick<Renda, 'id' | 'valor' | 'ativo' | 'created_at'>[],
  recebimentos: readonly Pick<RecebimentoRenda, 'renda_id' | 'competencia'>[],
): RendaDoMes {
  const lancada = centavos(transacoes.filter((t) => t.tipo === 'receita' && !t.ajuste).reduce((s, t) => s + Number(t.valor), 0));
  const recebidas = new Set(recebimentos.filter((r) => r.competencia === competencia).map((r) => r.renda_id));
  const aReceber = centavos(
    rendas.filter((r) => rendaVigente(r, competencia) && !recebidas.has(r.id)).reduce((s, r) => s + Number(r.valor), 0),
  );
  return { lancada, aReceber, total: centavos(lancada + aReceber) };
}

/** Gasto real do mês: despesas sem ajustes de saldo. */
export function gastoDoMes(transacoes: readonly Pick<Transacao, 'tipo' | 'valor' | 'ajuste'>[]): number {
  return centavos(transacoes.filter((t) => t.tipo === 'despesa' && !t.ajuste).reduce((s, t) => s + Number(t.valor), 0));
}

/**
 * R12: saldo total no fim do mês anterior (23:59 SP), pela fórmula da R2 até aquela data.
 * Só considera carteiras ativas e no total que já existiam antes do mês; nenhuma → `null`.
 */
export function comecouMesCom(
  carteiras: readonly Carteira[],
  transacoes: readonly TransacaoSaldo[],
  transferencias: readonly TransferenciaSaldo[],
  competencia: string,
): number | null {
  const fimAnterior = somarDias(`${competencia}-01`, -1);
  const existentes = carteiras.filter((c) => !c.arquivada && c.incluir_no_total && dataAncora(c) <= fimAnterior);
  if (!existentes.length) return null;
  return centavos(existentes.reduce((s, c) => s + saldoCarteira(c, transacoes, transferencias, fimAnterior), 0));
}

export interface FatiaCategoria {
  categoria: string;
  valor: number;
}

/** Gastos do mês por categoria (sem ajustes): top `limite` + o resto somado em "Outros". */
export function gastosPorCategoria(transacoes: readonly TransacaoMes[], limite = 5): FatiaCategoria[] {
  const mapa = new Map<string, number>();
  for (const t of transacoes) {
    if (t.tipo !== 'despesa' || t.ajuste) continue;
    const nome = t.categoria?.trim() || CATEGORIA_OUTROS;
    mapa.set(nome, (mapa.get(nome) ?? 0) + Number(t.valor));
  }
  const ordenadas = [...mapa.entries()]
    .map(([categoria, valor]) => ({ categoria, valor: centavos(valor) }))
    .sort((a, b) => b.valor - a.valor || a.categoria.localeCompare(b.categoria));
  const topo = ordenadas.slice(0, limite);
  const resto = ordenadas.slice(limite).reduce((s, f) => s + f.valor, 0);
  if (resto > 0) {
    const outros = topo.find((f) => f.categoria === CATEGORIA_OUTROS);
    if (outros) outros.valor = centavos(outros.valor + resto);
    else topo.push({ categoria: CATEGORIA_OUTROS, valor: centavos(resto) });
  }
  return topo;
}

export interface PontoEvolucao {
  dia: number;
  data: string;
  /** Gasto do dia (sem ajustes). */
  gasto: number;
  /** Saldo total no fim do dia; `null` antes de existir alguma carteira. */
  saldo: number | null;
}

/** Evolução do mês até hoje: gasto por dia (barras) + saldo acumulado no fim de cada dia (linha). */
export function evolucaoMes(
  competencia: string,
  hojeISO: string,
  transacoesMes: readonly TransacaoMes[],
  carteiras: readonly Carteira[],
  transacoesCarteiras: readonly TransacaoSaldo[],
  transferencias: readonly TransferenciaSaldo[],
): PontoEvolucao[] {
  const ultimo = fimDoMes(competencia);
  const ate = hojeISO < ultimo ? hojeISO : ultimo;
  const ativas = carteiras.filter((c) => !c.arquivada && c.incluir_no_total);
  const pontos: PontoEvolucao[] = [];
  for (let data = `${competencia}-01`; data <= ate; data = somarDias(data, 1)) {
    const gasto = centavos(
      transacoesMes.filter((t) => t.data === data && t.tipo === 'despesa' && !t.ajuste).reduce((s, t) => s + Number(t.valor), 0),
    );
    const existentes = ativas.filter((c) => dataAncora(c) <= data);
    const saldo = existentes.length
      ? centavos(existentes.reduce((s, c) => s + saldoCarteira(c, transacoesCarteiras, transferencias, data), 0))
      : null;
    pontos.push({ dia: Number(data.slice(8, 10)), data, gasto, saldo });
  }
  return pontos;
}
