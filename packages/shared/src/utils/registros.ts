import type { RegistroRefeicao, RegistroTreino, TipoRefeicaoRapida } from '../types/registros';
import { somarDias } from './saldo';

/** Ordem e rótulo das refeições rápidas (Dieta v1). */
export const TIPOS_REFEICAO_RAPIDA: readonly { tipo: TipoRefeicaoRapida; rotulo: string }[] = [
  { tipo: 'cafe', rotulo: 'Café da manhã' },
  { tipo: 'almoco', rotulo: 'Almoço' },
  { tipo: 'lanche', rotulo: 'Lanche' },
  { tipo: 'jantar', rotulo: 'Jantar' },
  { tipo: 'ceia', rotulo: 'Ceia' },
];

export function rotuloRefeicao(tipo: TipoRefeicaoRapida): string {
  return TIPOS_REFEICAO_RAPIDA.find((t) => t.tipo === tipo)?.rotulo ?? tipo;
}

/** Refeição provável pela hora (SP): sugestão inicial do formulário e do WhatsApp quando a pessoa não diz. */
export function refeicaoPelaHora(hora: number): TipoRefeicaoRapida {
  if (hora < 10) return 'cafe';
  if (hora < 15) return 'almoco';
  if (hora < 18) return 'lanche';
  if (hora < 22) return 'jantar';
  return 'ceia';
}

const DIA_MS = 86_400_000;
const paraData = (iso: string) => new Date(`${iso}T12:00:00Z`);
const paraISO = (d: Date) => d.toISOString().slice(0, 10);

/** Segunda-feira (ISO) da semana de `iso`. */
export function inicioSemana(iso: string): string {
  const d = paraData(iso);
  const dow = (d.getUTCDay() + 6) % 7; // 0 = segunda
  return paraISO(new Date(d.getTime() - dow * DIA_MS));
}

export interface ResumoSemana {
  /** Seg..Dom da semana de hoje: true = teve registro. */
  dias: boolean[];
  /** Índice de hoje em `dias` (0 = segunda). */
  hoje: number;
  diasAtivos: number;
  minutos: number;
  quantidade: number;
  /** Semanas seguidas com pelo menos um registro, contando a atual só se já tiver registro. */
  sequenciaSemanas: number;
}

/** Resumo semanal genérico (treino e refeição): conta só datas válidas até hoje. */
export function resumoSemana(registros: readonly Pick<RegistroTreino, 'data' | 'duracao_min'>[] | readonly Pick<RegistroRefeicao, 'data'>[], hojeISO: string): ResumoSemana {
  const seg = inicioSemana(hojeISO);
  const datas = new Set<string>();
  let minutos = 0;
  let quantidade = 0;
  for (const r of registros) {
    if (r.data > hojeISO) continue;
    datas.add(r.data);
    if (r.data >= seg) {
      quantidade++;
      minutos += ('duracao_min' in r && r.duracao_min) || 0;
    }
  }
  const dias = Array.from({ length: 7 }, (_, i) => datas.has(somarDias(seg, i)));
  const semanas = new Set([...datas].map(inicioSemana));
  let sequencia = 0;
  let cursor = semanas.has(seg) ? seg : somarDias(seg, -7);
  while (semanas.has(cursor)) {
    sequencia++;
    cursor = somarDias(cursor, -7);
  }
  return {
    dias,
    hoje: Math.round((paraData(hojeISO).getTime() - paraData(seg).getTime()) / DIA_MS),
    diasAtivos: dias.filter(Boolean).length,
    minutos,
    quantidade,
    sequenciaSemanas: sequencia,
  };
}

/**
 * Número de WhatsApp como o banco guarda (só dígitos, com DDI). 10–11 dígitos = Brasil sem DDI (ganha 55).
 * Vazio = null (desligar). Inválido = undefined.
 */
export function normalizarWhatsapp(entrada: string): string | null | undefined {
  const digitos = entrada.replace(/\D/g, '');
  if (!digitos) return null;
  const completo = digitos.length === 10 || digitos.length === 11 ? `55${digitos}` : digitos;
  return /^[0-9]{12,15}$/.test(completo) ? completo : undefined;
}

/** "+55 (11) 98888-7777" para exibir; outros países só com +. */
export function formatarWhatsapp(numero: string): string {
  const m = /^55(\d{2})(\d{4,5})(\d{4})$/.exec(numero);
  return m ? `+55 (${m[1]}) ${m[2]}-${m[3]}` : `+${numero}`;
}
