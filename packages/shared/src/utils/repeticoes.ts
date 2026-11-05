/**
 * Faixa de repetições de um exercício (migration 008: `exercicios.repeticoes_min` / `repeticoes_max`).
 * - faixa 8–12 → { min: 8, max: 12 }
 * - número fixo 10 → { min: 10, max: 10 }
 * - série sem repetição ("prancha 3 séries") → { min: null, max: null }
 * Linhas antigas só têm `repeticoes` (INTEGER): sem min/max, vale esse número como fixo.
 */
export interface FaixaRepeticoes {
  min: number | null;
  max: number | null;
}

export const SEM_REPETICOES: FaixaRepeticoes = { min: null, max: null };

const FAIXA = /^(\d{1,3})\s*(?:-|–|—|a|até)\s*(\d{1,3})$/i;
const FIXO = /^\d{1,3}$/;

/** "8-12", "8–12", "8 a 12", "10" ou vazio. Texto que não é faixa válida (12-8, 0, "muitas") devolve null. */
export function lerFaixaRepeticoes(texto: string | number | null | undefined): FaixaRepeticoes | null {
  if (texto === null || texto === undefined) return SEM_REPETICOES;
  const t = String(texto).trim();
  if (t === '') return SEM_REPETICOES;
  if (FIXO.test(t)) {
    const n = Number(t);
    return n >= 1 ? { min: n, max: n } : null;
  }
  const m = FAIXA.exec(t);
  if (!m) return null;
  const min = Number(m[1]);
  const max = Number(m[2]);
  return min >= 1 && max >= min ? { min, max } : null;
}

/** Faixa de uma linha do banco: min/max da 008 quando existem; senão o `repeticoes` antigo como número fixo. */
export function faixaDaLinha(linha: {
  repeticoes_min?: number | null;
  repeticoes_max?: number | null;
  repeticoes?: number | string | null;
}): FaixaRepeticoes {
  const min = linha.repeticoes_min ?? null;
  const max = linha.repeticoes_max ?? null;
  if (min !== null || max !== null) return { min: min ?? max, max: max ?? min };
  return lerFaixaRepeticoes(linha.repeticoes ?? null) ?? SEM_REPETICOES;
}

export function semRepeticoes(faixa: FaixaRepeticoes): boolean {
  return faixa.min === null && faixa.max === null;
}

/** "8–12", "10" ou "" (sem repetição). */
export function formatarFaixaRepeticoes(faixa: FaixaRepeticoes): string {
  if (semRepeticoes(faixa)) return '';
  if (faixa.min === faixa.max || faixa.max === null) return String(faixa.min);
  return `${faixa.min}–${faixa.max}`;
}

/** Prescrição do exercício: "3 × 8–12", "3 × 10" ou "3 séries" (sem repetição). */
export function formatarPrescricao(series: number, faixa: FaixaRepeticoes): string {
  if (semRepeticoes(faixa)) return series === 1 ? '1 série' : `${series} séries`;
  return `${series} × ${formatarFaixaRepeticoes(faixa)}`;
}
