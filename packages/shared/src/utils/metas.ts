import type { Competencia } from '../types/financas';

/**
 * Metas de compra (cálculo puro, sem I/O). Sugestão, não recomendação financeira: só divide o que falta pela
 * sobra do mês ("No fim do mês sobra", `sobraDoMes`). Sem investimento nem rendimento.
 */

/** Ícones que a meta pode usar (chaves; o app mapeia para lucide). Formato aceito pelo CHECK de metas.icone (007). */
export const ICONES_META = [
  'gamepad', 'smartphone', 'laptop', 'tv', 'car', 'bike', 'plane', 'house', 'sofa', 'shirt', 'gift',
  'graduation-cap', 'paw-print', 'heart', 'target',
] as const;
export type IconeMeta = (typeof ICONES_META)[number];

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

const brl = (valor: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor);
const emCentavos = (n: number) => Math.round(n * 100);

/** Competência `n` meses depois da data/competência informada. */
function competenciaMais(dataOuCompetencia: string, n: number): Competencia {
  const [a, m] = dataOuCompetencia.split('-').map(Number) as [number, number];
  const total = a * 12 + (m - 1) + n;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, '0')}` as Competencia;
}

/** "janeiro de 2027". */
export function rotuloMesAno(competencia: string): string {
  const [a, m] = competencia.split('-').map(Number) as [number, number];
  return `${MESES[m - 1]} de ${a}`;
}

/**
 * Meses inteiros do mês corrente até o mês da data limite (o dia não importa): 18/10/2026 → 31/01/2027 = 3
 * (novembro, dezembro e janeiro). 0 = a data é neste mês; negativo = já passou.
 */
export function mesesAtePrazo(hojeISO: string, dataLimite: string): number {
  const [ah, mh] = hojeISO.split('-').map(Number) as [number, number];
  const [al, ml] = dataLimite.split('-').map(Number) as [number, number];
  return al * 12 + ml - (ah * 12 + mh);
}

export interface PlanoMeta {
  porMes: number;
  /** Meses guardando `porMes` a partir do mês que vem. */
  meses: number;
  /** Mês em que dá para comprar (mês corrente + `meses`). */
  competencia: Competencia;
}

export type TipoSugestaoMeta = 'alcancada' | 'cabe' | 'nao_cabe' | 'sem_sobra' | 'sem_data' | 'prazo_curto' | 'prazo_passou';

export interface SugestaoMeta {
  tipo: TipoSugestaoMeta;
  /** max(0, alvo − guardado). */
  falta: number;
  /** `null` sem data limite. */
  mesesAtePrazo: number | null;
  /** Quanto guardar por mês para chegar no prazo (arredondado para cima em centavos); `null` sem prazo futuro. */
  porMes: number | null;
  /** Guardando a sobra inteira; `null` com sobra ≤ 0 ou meta alcançada. */
  sobraInteira: PlanoMeta | null;
  /** Guardando 50% da sobra (arredondado para baixo em centavos). */
  metadeDaSobra: PlanoMeta | null;
  texto: string;
  detalhes: string[];
}

export interface EntradaSugestaoMeta {
  hojeISO: string;
  /** "No fim do mês sobra" do mês corrente (`sobraDoMes(...).valor`). */
  sobraMensal: number;
  valorAlvo: number;
  valorGuardado: number;
  dataLimite: string | null;
}

function plano(hojeISO: string, faltaCentavos: number, porMesCentavos: number): PlanoMeta | null {
  if (porMesCentavos <= 0) return null;
  const meses = Math.ceil(faltaCentavos / porMesCentavos);
  return { porMes: porMesCentavos / 100, meses, competencia: competenciaMais(hojeISO, meses) };
}

const linhaPlano = (rotulo: string, p: PlanoMeta) =>
  `${rotulo} (${brl(p.porMes)} por mês): ${p.meses} ${p.meses === 1 ? 'mês' : 'meses'}, em ${rotuloMesAno(p.competencia)}.`;

/** Sugestão de quanto guardar por mês para a meta, pela sobra do mês. */
export function sugestaoMeta({ hojeISO, sobraMensal, valorAlvo, valorGuardado, dataLimite }: EntradaSugestaoMeta): SugestaoMeta {
  const faltaCentavos = Math.max(0, emCentavos(valorAlvo) - emCentavos(valorGuardado));
  const falta = faltaCentavos / 100;
  const meses = dataLimite ? mesesAtePrazo(hojeISO, dataLimite) : null;
  const base = { falta, mesesAtePrazo: meses, porMes: null, sobraInteira: null, metadeDaSobra: null, detalhes: [] };
  if (faltaCentavos === 0) return { ...base, tipo: 'alcancada', texto: 'Meta alcançada' };

  const sobraCentavos = emCentavos(sobraMensal);
  if (sobraCentavos <= 0) {
    return {
      ...base, tipo: 'sem_sobra', texto: 'Com a sobra atual não dá para guardar; revise despesas',
      detalhes: meses !== null && meses < 0 ? ['O prazo passou.'] : [],
    };
  }
  const sobraInteira = plano(hojeISO, faltaCentavos, sobraCentavos)!;
  const metadeDaSobra = plano(hojeISO, faltaCentavos, Math.floor(sobraCentavos / 2));
  const planos = { sobraInteira, metadeDaSobra };
  const detalhes = [
    linhaPlano('Guardando a sobra inteira', sobraInteira),
    ...(metadeDaSobra ? [linhaPlano('Guardando metade da sobra', metadeDaSobra)] : []),
  ];

  if (meses === null) {
    const p = metadeDaSobra ?? sobraInteira;
    return {
      ...base, ...planos, tipo: 'sem_data', detalhes: [linhaPlano('Guardando a sobra inteira', sobraInteira)],
      texto: `Guardando ${metadeDaSobra ? 'metade da sobra' : 'a sobra'} (${brl(p.porMes)} por mês), em ${p.meses} ${p.meses === 1 ? 'mês' : 'meses'} (${rotuloMesAno(p.competencia)}) você compra`,
    };
  }
  if (meses < 0) return { ...base, ...planos, tipo: 'prazo_passou', detalhes, texto: `O prazo passou e faltam ${brl(falta)}` };
  if (meses === 0) {
    return { ...base, ...planos, tipo: 'prazo_curto', detalhes, texto: `Prazo curto: a data é neste mês e faltam ${brl(falta)}` };
  }

  const porMes = Math.ceil(faltaCentavos / meses) / 100;
  if (emCentavos(porMes) <= sobraCentavos) {
    return {
      ...base, ...planos, porMes, tipo: 'cabe',
      texto: `Guarde ${brl(porMes)} por mês e em ${rotuloMesAno(competenciaMais(hojeISO, meses))} você compra`,
    };
  }
  return { ...base, ...planos, porMes, tipo: 'nao_cabe', detalhes, texto: `${brl(porMes)} por mês não cabe na sua sobra de ${brl(sobraMensal)}` };
}
