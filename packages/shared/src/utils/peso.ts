import { GANHO_SEMANAL_MAX_PCT, GANHO_SEMANAL_MIN_PCT } from '../constants/saude';
import { somarDias } from './saldo';

/**
 * Peso: médias de 7/30/90 dias, série do gráfico e meta realista (PLANO-F1 §3.4, anexo TACO §2).
 * Datas em 'AAAA-MM-DD' (registros_peso.data), contadas em dias de calendário, sem fuso.
 */

export interface PontoPeso {
  data: string;
  peso: number;
}

export interface PontoGraficoPeso {
  data: string;
  /** Peso registrado no dia; null = sem registro. */
  peso: number | null;
  /** Média simples dos registros dos 7 dias que terminam nesta data; null = nenhum registro na janela. */
  media7: number | null;
}

const DIA_MS = 86_400_000;
const paraDia = (data: string) => Math.floor(Date.UTC(+data.slice(0, 4), +data.slice(5, 7) - 1, +data.slice(8, 10)) / DIA_MS);

export function diasEntre(de: string, ate: string): number {
  return paraDia(ate) - paraDia(de);
}

const arred2 = (n: number) => Math.round(n * 100) / 100;

/** Média simples dos registros em (fim − dias, fim]. null se não há registro na janela. */
export function mediaPeso(registros: readonly PontoPeso[], fim: string, dias: number): number | null {
  const ate = paraDia(fim);
  const desde = ate - dias + 1;
  const janela = registros.filter((r) => {
    const d = paraDia(r.data);
    return d >= desde && d <= ate && Number.isFinite(r.peso);
  });
  if (janela.length === 0) return null;
  return arred2(janela.reduce((s, r) => s + Number(r.peso), 0) / janela.length);
}

/** Um ponto por dia de `hoje − (dias − 1)` até `hoje`, com o peso do dia e a média de 7 dias. */
export function serieGraficoPeso(registros: readonly PontoPeso[], hoje: string, dias: number): PontoGraficoPeso[] {
  const porDia = new Map(registros.map((r) => [r.data.slice(0, 10), Number(r.peso)]));
  return Array.from({ length: dias }, (_, i) => {
    const data = somarDias(hoje, i - dias + 1);
    return { data, peso: porDia.get(data) ?? null, media7: mediaPeso(registros, data, 7) };
  });
}

/** Último registro (o mais recente por data). */
export function ultimoPeso(registros: readonly PontoPeso[]): PontoPeso | null {
  return registros.reduce<PontoPeso | null>((m, r) => (!m || r.data > m.data ? r : m), null);
}

/** kg por semana de um ritmo em % do peso: 0,375% de 71,3 kg ≈ 0,27. */
export function ritmoKgSemana(pct: number, pesoKg: number): number {
  return arred2((pct / 100) * pesoKg);
}

export interface MetaRealista {
  semanas: number;
  /** (peso-meta − peso atual) ÷ semanas até o prazo. */
  pedidoKgSemana: number;
  /** 0,25% e 0,5% do peso atual. */
  refMinKgSemana: number;
  refMaxKgSemana: number;
  /** Pedido dentro do teto de 0,5% do peso por semana. */
  realista: boolean;
}

/**
 * Meta realista (Iraki et al. 2019): realista se o ganho pedido por semana ≤ 0,5% do peso atual.
 * `pesoAtualKg` = média de 7 dias. Prazo no passado ou hoje → null (não dá para medir).
 */
export function metaRealista(p: { pesoMetaKg: number; pesoAtualKg: number; hoje: string; prazo: string }): MetaRealista | null {
  const dias = diasEntre(p.hoje, p.prazo);
  if (dias <= 0 || !Number.isFinite(p.pesoMetaKg) || !Number.isFinite(p.pesoAtualKg) || p.pesoAtualKg <= 0) return null;
  const semanas = dias / 7;
  const pedido = (p.pesoMetaKg - p.pesoAtualKg) / semanas;
  const teto = (GANHO_SEMANAL_MAX_PCT / 100) * p.pesoAtualKg;
  return {
    semanas: arred2(semanas),
    pedidoKgSemana: arred2(pedido),
    refMinKgSemana: arred2((GANHO_SEMANAL_MIN_PCT / 100) * p.pesoAtualKg),
    refMaxKgSemana: arred2(teto),
    realista: pedido <= teto + 1e-9,
  };
}
