import type { Habito, RegistroHabito } from '@meudia/shared';
import { ultimosDiasSP } from './hoje';

export type StatusDia = 'done' | 'partial' | 'today' | 'missed' | 'rest' | 'pending';
export interface DiaHistorico {
  iso: string;
  diaSemana: ReturnType<typeof ultimosDiasSP>[number]['diaSemana'];
  diaDoMes: string;
  status: StatusDia;
}

/**
 * "Últimos 7 dias" dos hábitos: dias civis de SP terminando hoje (`ultimosDiasSP`), o último é o mesmo `hojeSP()`
 * das consultas de hoje, em qualquer fuso do aparelho.
 */
export function historicoHabitos(
  habitosAtivos: readonly Pick<Habito, 'frequencia' | 'dias_semana'>[],
  registros: readonly Pick<RegistroHabito, 'data' | 'concluido'>[] | undefined,
  agora: Date = new Date(),
  n = 7,
): DiaHistorico[] {
  const dias = ultimosDiasSP(n, agora);
  return dias.map((d, i) => {
    const hoje = i === dias.length - 1;
    if (!registros || habitosAtivos.length === 0) return { ...d, status: 'pending' };
    const doDia = habitosAtivos.filter((h) => h.frequencia === 'diario' || h.dias_semana.includes(d.diaSemana));
    if (doDia.length === 0) return { ...d, status: 'rest' };
    const feitos = registros.filter((r) => r.data === d.iso && r.concluido).length;
    const pct = (feitos / doDia.length) * 100;
    const status: StatusDia = pct >= 80 ? 'done' : pct >= 50 ? 'partial' : hoje ? 'today' : 'missed';
    return { ...d, status };
  });
}
