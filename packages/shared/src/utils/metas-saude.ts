import {
  FATORES_ATIVIDADE,
  FATOR_GANHO,
  MIFFLIN,
  PROTEINA_G_KG_MAX,
  PROTEINA_G_KG_MIN,
  PROTEINA_G_KG_PADRAO,
  type NivelAtividade,
  type ObjetivoSaude,
  type SexoFormula,
} from '../constants/saude';

/**
 * Metas de calorias e proteína do cadastro de saúde (design-system B §5, PLANO-F1 §10.2).
 * Funções puras: sem rede, sem banco e sem log (dado de saúde não vai para log).
 */

export interface RespostasSaude {
  idade: number;
  sexo: SexoFormula;
  alturaCm: number;
  pesoKg: number;
  nivel: NivelAtividade;
  objetivo: ObjetivoSaude;
}

export type OrigemMeta = 'calculada' | 'manual';

export interface CalculoMetas {
  /** TMB arredondada (kcal). */
  tmb: number;
  /** Gasto estimado = TMB × fator de atividade, arredondado. */
  gasto: number;
  /** Meta do dia: ganhar = gasto × 1,10; manter = gasto. */
  kcal: number;
  proteinaG: number;
}

export interface MetasSaude {
  kcal: number;
  kcalCalculada: number | null;
  kcalOrigem: OrigemMeta;
  /** Faixa de proteína em g/dia; calculada = um número só (min = max). */
  proteinaMinG: number;
  proteinaMaxG: number;
  proteinaCalculadaG: number | null;
  proteinaOrigem: OrigemMeta;
  proteinaGKg: number;
}

/** Mifflin-St Jeor simplificada: 10×peso + 6,25×altura − 5×idade, +5 (homem) ou −161 (mulher). Sem arredondar. */
export function calcularTmb({ sexo, pesoKg, alturaCm, idade }: Pick<RespostasSaude, 'sexo' | 'pesoKg' | 'alturaCm' | 'idade'>): number {
  const base = MIFFLIN.PESO * pesoKg + MIFFLIN.ALTURA * alturaCm - MIFFLIN.IDADE * idade;
  return base + (sexo === 'masculino' ? MIFFLIN.MASCULINO : MIFFLIN.FEMININO);
}

export function calcularProteinaG(pesoKg: number, gKg: number = PROTEINA_G_KG_PADRAO): number {
  return Math.round(pesoKg * gKg);
}

/**
 * TMB → gasto (× 1,40 / 1,70 / 2,00) → meta (ganhar × 1,10). Cada etapa arredonda para o inteiro,
 * e a meta sai do gasto já arredondado, para a linha "gasto estimado X kcal + 10%" fechar com o número da tela.
 */
export function calcularMetas(r: RespostasSaude, proteinaGKg: number = PROTEINA_G_KG_PADRAO): CalculoMetas {
  const tmb = Math.round(calcularTmb(r));
  const gasto = Math.round(tmb * FATORES_ATIVIDADE[r.nivel]);
  const kcal = r.objetivo === 'ganhar' ? Math.round(gasto * FATOR_GANHO) : gasto;
  return { tmb, gasto, kcal, proteinaG: calcularProteinaG(r.pesoKg, proteinaGKg) };
}

export function proteinaGKgValida(gKg: number): boolean {
  return Number.isFinite(gKg) && gKg >= PROTEINA_G_KG_MIN - 1e-9 && gKg <= PROTEINA_G_KG_MAX + 1e-9;
}

/** Campos do cadastro fora do intervalo aceito. Vazio = pode calcular. */
export function errosRespostasSaude(r: Partial<RespostasSaude>): Partial<Record<keyof RespostasSaude, string>> {
  const erros: Partial<Record<keyof RespostasSaude, string>> = {};
  const fora = (v: number | undefined, min: number, max: number) => v === undefined || !Number.isFinite(v) || v < min || v > max;
  if (fora(r.idade, 15, 100)) erros.idade = 'Idade entre 15 e 100 anos.';
  if (!r.sexo) erros.sexo = 'Escolha uma opção.';
  if (fora(r.alturaCm, 100, 250)) erros.alturaCm = 'Altura entre 100 e 250 cm.';
  if (fora(r.pesoKg, 30, 300)) erros.pesoKg = 'Peso entre 30 e 300 kg.';
  if (!r.nivel) erros.nivel = 'Escolha o nível de atividade.';
  if (!r.objetivo) erros.objetivo = 'Escolha o objetivo.';
  return erros;
}

/**
 * Recalcula sem apagar o que a pessoa definiu: o valor calculado é sempre atualizado,
 * mas a meta vigente só muda quando a origem é "calculada" (PLANO-F1 §10.5).
 */
export function recalcularMetas(atual: MetasSaude | null, calculo: CalculoMetas, proteinaGKg?: number): MetasSaude {
  const gKg = proteinaGKg ?? atual?.proteinaGKg ?? PROTEINA_G_KG_PADRAO;
  const kcalManual = atual?.kcalOrigem === 'manual';
  const protManual = atual?.proteinaOrigem === 'manual';
  return {
    kcal: kcalManual ? atual.kcal : calculo.kcal,
    kcalCalculada: calculo.kcal,
    kcalOrigem: kcalManual ? 'manual' : 'calculada',
    proteinaMinG: protManual ? atual.proteinaMinG : calculo.proteinaG,
    proteinaMaxG: protManual ? atual.proteinaMaxG : calculo.proteinaG,
    proteinaCalculadaG: calculo.proteinaG,
    proteinaOrigem: protManual ? 'manual' : 'calculada',
    proteinaGKg: gKg,
  };
}

/** Metas digitadas sem cálculo (ex.: quem pulou o cadastro). */
export function metasManuais(kcal: number, proteinaMinG: number, proteinaMaxG = proteinaMinG, pesoKg?: number): MetasSaude {
  return {
    kcal,
    kcalCalculada: null,
    kcalOrigem: 'manual',
    proteinaMinG,
    proteinaMaxG,
    proteinaCalculadaG: null,
    proteinaOrigem: 'manual',
    proteinaGKg: pesoKg ? Math.round((proteinaMinG / pesoKg) * 100) / 100 : PROTEINA_G_KG_PADRAO,
  };
}

export function definirKcalManual(metas: MetasSaude, kcal: number): MetasSaude {
  return { ...metas, kcal: Math.round(kcal), kcalOrigem: 'manual' };
}

export function usarKcalCalculada(metas: MetasSaude): MetasSaude {
  if (metas.kcalCalculada === null) return metas;
  return { ...metas, kcal: metas.kcalCalculada, kcalOrigem: 'calculada' };
}

export function usarProteinaCalculada(metas: MetasSaude): MetasSaude {
  if (metas.proteinaCalculadaG === null) return metas;
  return { ...metas, proteinaMinG: metas.proteinaCalculadaG, proteinaMaxG: metas.proteinaCalculadaG, proteinaOrigem: 'calculada' };
}

/** "126", "120-140" ou "120–140" → faixa em g. Texto inválido ou max < min → null. */
export function lerFaixaProteina(texto: string): { min: number; max: number } | null {
  const partes = texto.trim().split(/\s*[-–a]\s*/).filter(Boolean);
  if (partes.length < 1 || partes.length > 2) return null;
  const nums = partes.map((p) => Number(p.replace(',', '.')));
  if (nums.some((n) => !Number.isFinite(n) || n <= 0)) return null;
  const min = Math.round(nums[0]!);
  const max = Math.round(nums[1] ?? nums[0]!);
  return max >= min ? { min, max } : null;
}

/**
 * Proteína definida à mão: cada ponta tem de ficar entre 1,4 e 2,2 g/kg do peso.
 * Retorna as metas novas ou a mensagem de erro (com a faixa em gramas para esse peso).
 */
export function definirProteinaManual(metas: MetasSaude, faixa: { min: number; max: number }, pesoKg: number): MetasSaude | string {
  const minG = Math.ceil(pesoKg * PROTEINA_G_KG_MIN);
  const maxG = Math.floor(pesoKg * PROTEINA_G_KG_MAX);
  if (faixa.min < minG || faixa.max > maxG) {
    return `Para ${formatarKg(pesoKg)} kg, fica entre ${minG} e ${maxG} g (1,4 a 2,2 g/kg).`;
  }
  return {
    ...metas,
    proteinaMinG: faixa.min,
    proteinaMaxG: faixa.max,
    proteinaOrigem: 'manual',
    proteinaGKg: Math.round((faixa.min / pesoKg) * 100) / 100,
  };
}

const formatarKg = (kg: number) => kg.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
