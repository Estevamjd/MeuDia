import { parseISO } from 'date-fns';
import { hojeSP, somarDias } from '@meudia/shared';

export type DiaSemana = 0 | 1 | 2 | 3 | 4 | 5 | 6;

/**
 * "Hoje" no front é sempre o dia de São Paulo (`hojeSP`), nunca `toISOString()` (UTC: depois das 21h em BRT já é
 * amanhã) nem o fuso do aparelho. Varredura em `lib/__tests__/hoje.test.ts`.
 */
export { hojeSP };

/** Dia da semana (0 = domingo, como `treinos.dia_semana`) de uma data AAAA-MM-DD, sem depender do fuso do aparelho. */
export function diaSemanaDe(iso: string): DiaSemana {
  return new Date(`${iso}T12:00:00Z`).getUTCDay() as DiaSemana;
}

/** Dia da semana de hoje em São Paulo. */
export function diaSemanaSP(agora: Date = new Date()): DiaSemana {
  return diaSemanaDe(hojeSP(agora));
}

/**
 * Hoje (SP) como `Date` à meia-noite do fuso do aparelho: para `format`/`addDays`/`getDay` do date-fns e para
 * cabeçalhos. Dá o dia civil de SP em qualquer fuso (UTC, Tóquio), ao contrário de `new Date()`.
 * Para instantes de verdade (hora, created_at) continue usando `new Date()`.
 */
export function dataCivilSP(agora: Date = new Date()): Date {
  return parseISO(hojeSP(agora));
}

/** Ano e mês (1–12) de hoje em SP (resumo do mês), sem depender do fuso do aparelho. */
export function anoMesSP(agora: Date = new Date()): { ano: number; mes: number } {
  const [ano, mes] = hojeSP(agora).split('-').map(Number);
  return { ano: ano!, mes: mes! };
}

/** Os últimos `n` dias civis de SP terminando hoje, do mais antigo para hoje. */
export function ultimosDiasSP(n: number, agora: Date = new Date()): { iso: string; diaSemana: DiaSemana; diaDoMes: string }[] {
  const hoje = hojeSP(agora);
  return Array.from({ length: n }, (_, i) => {
    const iso = somarDias(hoje, i - (n - 1));
    return { iso, diaSemana: diaSemanaDe(iso), diaDoMes: iso.slice(8, 10) };
  });
}
