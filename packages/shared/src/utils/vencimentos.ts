import type { EtapaLembrete } from '../types/financas';

export function vencimentoNoMes(dia: number, ano: number, mes: number): string {
  const ultimo = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
  return `${String(ano).padStart(4, '0')}-${String(mes).padStart(2, '0')}-${String(Math.min(dia, ultimo)).padStart(2, '0')}`;
}

export function proximoVencimento(dia: number, hojeISO: string): string {
  const [ano, mes] = hojeISO.split('-').map(Number) as [number, number, number];
  const atual = vencimentoNoMes(dia, ano, mes);
  return atual >= hojeISO ? atual : vencimentoNoMes(dia, mes === 12 ? ano + 1 : ano, mes === 12 ? 1 : mes + 1);
}

export function diasAte(dataISO: string, hojeISO: string): number {
  return (Date.parse(`${dataISO}T00:00:00Z`) - Date.parse(`${hojeISO}T00:00:00Z`)) / 86400000;
}

export function hojeSP(now = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(now);
  const part = (type: string) => parts.find(p => p.type === type)!.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}

export function competenciaDe(dataISO: string): string {
  return dataISO.slice(0, 7);
}

export function etapaLembrete(vencimentoISO: string, hojeISO: string): EtapaLembrete | null {
  const dias = diasAte(vencimentoISO, hojeISO);
  return dias === 2 ? 'D-2' : dias === 1 ? 'D-1' : dias === 0 ? 'D0' : null;
}

/** Início de um dia civil em São Paulo, em ISO UTC (sem depender do fuso do processo).
 * Se a meia-noite foi pulada pelo horário de verão, retorna o primeiro instante desse dia.
 */
export function inicioDoDiaSP(data: string): string {
  const meiaNoiteUTC = Date.parse(`${data}T00:00:00Z`);
  const formato = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Sao_Paulo', timeZoneName: 'longOffset',
  });
  const offsetEm = (instante: number): number => {
    const nome = formato.formatToParts(new Date(instante)).find(p => p.type === 'timeZoneName')!.value;
    const [, sinal, horas, minutos] = /GMT([+-])(\d{2}):(\d{2})/.exec(nome)!;
    return (sinal === '-' ? -1 : 1) * (Number(horas) * 60 + Number(minutos)) * 60_000;
  };
  const offset = offsetEm(meiaNoiteUTC);
  const candidato = meiaNoiteUTC - offset;
  // Confere o offset na meia-noite local: a transição pode ocorrer entre os dois instantes.
  return new Date(Math.max(candidato, meiaNoiteUTC - offsetEm(candidato))).toISOString();
}
