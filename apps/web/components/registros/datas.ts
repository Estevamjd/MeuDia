/** dd/mm a partir de AAAA-MM-DD (sem fuso). */
export function diaMes(iso: string): string {
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
}

/** "Hoje", "Ontem" ou dd/mm. */
export function quando(iso: string, hojeISO: string, ontemISO: string): string {
  if (iso === hojeISO) return 'Hoje';
  if (iso === ontemISO) return 'Ontem';
  return diaMes(iso);
}

/** Hora atual em São Paulo (0–23). */
export function horaSP(agora: Date = new Date()): number {
  return Number(new Intl.DateTimeFormat('pt-BR', { hour: 'numeric', hourCycle: 'h23', timeZone: 'America/Sao_Paulo' }).format(agora));
}
