import type { Competencia, FatiaCategoria, PontoEvolucao, SobraDoMes } from '@meudia/shared';
import { CATEGORIA_OUTROS } from '@meudia/shared';
import { CATEGORICAS, COR_OUTROS } from '../home/paletaGraficos';

/** Números do bloco principal do Painel (mês corrente, pela conta da sobra). Puro. */
export interface NumerosPainel {
  /** Renda do mês inteira (recebida + a receber); base das partes e da linha de renda do gráfico. */
  recebeu: number;
  /** Alguma renda do mês ainda sem "Recebi". */
  previsao: boolean;
  /** Parte da renda já lançada (com "Recebi"). */
  recebido: number;
  /** Parte da renda ainda sem "Recebi" (0 fora da previsão). */
  faltaReceber: number;
  /** Contas fixas já pagas + gastos extras. */
  jaGastou: number;
  /** Contas fixas ainda sem "Paguei". */
  faltaPagar: number;
  contasAPagar: number;
  fixas: number;
  extras: number;
  sobra: number;
  /** Partes da renda (0–100, somam 100 quando a sobra é positiva); `null` sem renda. */
  partes: { fixas: number; extras: number; sobra: number } | null;
}

export function numerosPainel(s: SobraDoMes): NumerosPainel {
  const centavos = (n: number) => Math.round(n * 100);
  const faltaPagar = Math.max(0, centavos(s.totalContasFixas) - centavos(s.totalContasPagas)) / 100;
  const renda = s.renda.total;
  let partes: NumerosPainel['partes'] = null;
  if (renda > 0) {
    const fixas = Math.min(100, Math.round((s.totalContasFixas / renda) * 100));
    const extras = Math.min(100 - fixas, Math.round((s.gastosExtras / renda) * 100));
    partes = { fixas, extras, sobra: Math.max(0, 100 - fixas - extras) };
  }
  const faltaReceber = s.previsao ? Math.max(0, centavos(renda) - centavos(s.renda.lancada ?? 0)) / 100 : 0;
  return {
    recebeu: renda,
    previsao: s.previsao,
    recebido: (centavos(renda) - centavos(faltaReceber)) / 100,
    faltaReceber,
    jaGastou: (centavos(s.totalContasPagas) + centavos(s.gastosExtras)) / 100,
    faltaPagar,
    contasAPagar: s.contasFixas.filter((c) => !c.paga).length,
    fixas: s.totalContasFixas,
    extras: s.gastosExtras,
    sobra: s.valor,
    partes,
  };
}

/** Fatias com cor fixa por posição (top 5) e cinza no "Outros" — mesma regra do gráfico de Gastos › Análise. */
export function fatiasComCor(fatias: readonly FatiaCategoria[]): (FatiaCategoria & { cor: string })[] {
  let slot = 0;
  return fatias.map((f) => ({ ...f, cor: f.categoria === CATEGORIA_OUTROS ? COR_OUTROS : CATEGORICAS[slot++ % CATEGORICAS.length]! }));
}

export interface PontoAcumulado {
  dia: number;
  /** Total gasto do dia 1 até este dia; `null` depois de hoje. */
  gasto: number | null;
  /** Pontilhado de hoje até o fim do mês com as contas que faltam pagar; `null` antes de hoje. */
  previsto: number | null;
}

/**
 * "Seu mês dia a dia": gasto acumulado por dia (das barras diárias de `evolucaoMes`) e, se faltar pagar alguma conta,
 * a linha prevista de hoje até o último dia do mês.
 */
export function gastoAcumulado(pontos: readonly PontoEvolucao[], competencia: Competencia, faltaPagar: number): PontoAcumulado[] {
  const [a, m] = competencia.split('-').map(Number) as [number, number];
  const ultimoDia = new Date(Date.UTC(a, m, 0)).getUTCDate();
  const porDia = new Map(pontos.map((p) => [p.dia, p.gasto]));
  const hoje = pontos.length ? Math.max(...pontos.map((p) => p.dia)) : 0;
  const saida: PontoAcumulado[] = [];
  let soma = 0;
  for (let dia = 1; dia <= ultimoDia; dia++) {
    if (dia <= hoje) soma = Math.round((soma + (porDia.get(dia) ?? 0)) * 100) / 100;
    const gasto = dia <= hoje ? soma : null;
    let previsto: number | null = null;
    if (faltaPagar > 0 && hoje > 0 && hoje < ultimoDia && dia >= hoje) {
      previsto = Math.round((soma + (faltaPagar * (dia - hoje)) / (ultimoDia - hoje)) * 100) / 100;
    }
    saida.push({ dia, gasto, previsto });
  }
  return saida;
}

export interface SobraMes {
  competencia: Competencia;
  rotulo: string;
  valor: number;
  /** Mês corrente: ainda é previsão ("Deve sobrar"). */
  previsao: boolean;
}

const MESES_CURTOS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

/** Competências dos últimos `n` meses terminando em `competencia` (mais antiga primeiro). */
export function ultimosMeses(competencia: Competencia, n = 6): Competencia[] {
  const [a, m] = competencia.split('-').map(Number) as [number, number];
  return Array.from({ length: n }, (_, i) => {
    const total = a * 12 + (m - 1) - (n - 1 - i);
    return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, '0')}` as Competencia;
  });
}

interface LancamentoSobra {
  tipo: 'receita' | 'despesa';
  valor: number | string;
  ajuste?: boolean | null;
}

/**
 * "Quanto sobrou por mês": nos meses fechados, o que entrou − o que saiu (sem ajustes de saldo); no mês corrente, o
 * "Deve sobrar". Meses sem nenhum lançamento ficam fora (não viram um zero falso).
 */
export function sobraPorMes(
  meses: readonly { competencia: Competencia; transacoes: readonly LancamentoSobra[] | undefined }[],
  atual: { competencia: Competencia; valor: number } | null,
): SobraMes[] {
  return meses.flatMap(({ competencia, transacoes }): SobraMes[] => {
    const rotulo = MESES_CURTOS[Number(competencia.slice(5, 7)) - 1]!;
    if (atual && competencia === atual.competencia) return [{ competencia, rotulo, valor: atual.valor, previsao: true }];
    const validas = (transacoes ?? []).filter((t) => !t.ajuste);
    if (validas.length === 0) return [];
    const centavos = validas.reduce((s, t) => s + (t.tipo === 'receita' ? 1 : -1) * Math.round(Number(t.valor) * 100), 0);
    return [{ competencia, rotulo, valor: centavos / 100, previsao: false }];
  });
}

/** Faixa de datas (AAAA-MM-DD, inclusiva) que cobre as competências: 1º dia da mais antiga → último dia da mais nova. */
export function faixaDosMeses(competencias: readonly Competencia[]): { inicio: string; fim: string } {
  const primeira = competencias[0]!;
  const ultima = competencias[competencias.length - 1]!;
  const [a, m] = ultima.split('-').map(Number) as [number, number];
  const ultimoDia = new Date(Date.UTC(a, m, 0)).getUTCDate();
  return { inicio: `${primeira}-01`, fim: `${ultima}-${String(ultimoDia).padStart(2, '0')}` };
}

/**
 * Separa os lançamentos de uma faixa por competência (`data.slice(0, 7)`). Cada mês sai em ordem (data, id)
 * decrescente, como a consulta de um mês só (`transacoesDoMes`, data decrescente). Mês sem lançamento = [].
 */
export function separarPorCompetencia<T extends { data: string; id: string }>(
  transacoes: readonly T[],
  competencias: readonly Competencia[],
): Map<Competencia, T[]> {
  const porMes = new Map<Competencia, T[]>(competencias.map((c) => [c, []]));
  for (const t of transacoes) porMes.get(t.data.slice(0, 7) as Competencia)?.push(t);
  for (const lista of porMes.values()) lista.sort((x, y) => y.data.localeCompare(x.data) || y.id.localeCompare(x.id));
  return porMes;
}
