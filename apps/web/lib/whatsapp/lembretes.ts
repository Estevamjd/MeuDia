import { createHash } from 'node:crypto';
import type { Estilo, Meta } from './contato';
import { temMetaDieta } from './ganchos';

/**
 * Lembretes proativos (docs/whatsapp.md §7.1). Funções puras: escolhem, para cada pessoa, NO MÁXIMO UM lembrete
 * por rodada (o cron roda a cada 15 min), a partir do que está registrado no sistema. Quem envia é a rota
 * /api/whatsapp/lembretes; o banco ainda confere teto diário, chave repetida e opt-in na hora de reservar.
 */

export type TipoLembrete = 'conta' | 'treino' | 'parabens' | 'checkin' | 'refeicao';

export interface Candidato {
  telefone: string;
  nome: string | null;
  objetivo: string | null;
  metas: Meta[];
  fatos: string[];
  estilo: Estilo;
  lembreteHora: number | null;
  horaInferida: number | null;
  enviosHoje: number;
  enviosTotal: number;
  enviosSemResposta: number;
  chaves7d: string[];
  treinoHoje: { nome: string; hora: number | null } | null;
  treinouHoje: boolean;
  gastosHoje: number;
  refeicoesHoje: number;
  contas: { id: string; descricao: string; valor: number; vence: string }[];
}

export interface Lembrete {
  tipo: TipoLembrete;
  chave: string;
  /** Dado verdadeiro que vira texto (nome do treino, conta e vencimento…). */
  dados: Record<string, string | number>;
}

export const REGRAS = {
  silencioInicio: 22, // 22h–8h sem mensagem
  silencioFim: 8,
  maxPorDia: 2,
  /** Depois de N lembretes sem a pessoa escrever nada, para até ela voltar a falar (não insistir). */
  maxSemResposta: 3,
  horaPadraoTreino: 18,
  jitterMin: 40,
  checkinHora: 20,
  checkinPorSemana: 3,
  checkinChance: 0.55,
  refeicaoHora: 12,
  refeicaoMinuto: 30,
  refeicaoPorSemana: 2,
  refeicaoChance: 0.4,
  parabensChance: 0.3,
  parabensPorSemana: 2,
  contaHora: 9,
} as const;

/** Hora e minuto em São Paulo. */
export function relogioSP(agora: Date): { dia: string; minutos: number } {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
      .formatToParts(agora)
      .map((x) => [x.type, x.value]),
  );
  return { dia: `${p.year}-${p.month}-${p.day}`, minutos: Number(p.hour) * 60 + Number(p.minute) };
}

/** Número estável em [0,1) por pessoa+dia+tipo: o mesmo a cada rodada, diferente a cada dia (sorteio sem estado). */
export function sorteio(...partes: string[]): number {
  return createHash('sha256').update(partes.join('|')).digest().readUInt32BE(0) / 2 ** 32;
}

export const emSilencio = (minutos: number) => minutos < REGRAS.silencioFim * 60 || minutos >= REGRAS.silencioInicio * 60;

/** Hora do lembrete de treino: preferida > 1h antes do horário do plano > 1h antes do horário em que costuma registrar > 18h. */
export function horaDoTreino(c: Pick<Candidato, 'lembreteHora' | 'treinoHoje' | 'horaInferida'>): number {
  const h = c.lembreteHora ?? (c.treinoHoje?.hora != null ? c.treinoHoje.hora - 1 : c.horaInferida != null ? c.horaInferida - 1 : REGRAS.horaPadraoTreino);
  return Math.min(21, Math.max(REGRAS.silencioFim, h));
}

const conta7d = (c: Candidato, tipo: TipoLembrete) => c.chaves7d.filter((k) => k.startsWith(`${tipo}:`)).length;

/**
 * O lembrete desta rodada para esta pessoa (ou nenhum). Ordem de prioridade: conta > treino > parabéns > check-in > refeição.
 * Cada tipo tem uma janela: só dispara depois do horário-alvo + atraso aleatório (jitter) e antes do fim da janela.
 */
export function escolherLembrete(c: Candidato, agora: Date): Lembrete | null {
  const { dia, minutos } = relogioSP(agora);
  if (emSilencio(minutos)) return null;
  if (c.enviosHoje >= REGRAS.maxPorDia) return null;
  if (c.enviosSemResposta >= REGRAS.maxSemResposta) return null;

  const jitter = (tipo: string) => Math.floor(sorteio(c.telefone, dia, tipo, 'jitter') * REGRAS.jitterMin);
  const naJanela = (tipo: string, alvoMin: number, fimMin: number) => minutos >= alvoMin + jitter(tipo) && minutos < Math.min(fimMin, REGRAS.silencioInicio * 60);
  const jaFoi = (chave: string) => c.chaves7d.includes(chave);
  const opcoes: Lembrete[] = [];

  // Conta que vence em até 2 dias (uma mensagem por conta e vencimento), de manhã.
  const conta = c.contas.find((k) => !jaFoi(`conta:${k.id}:${k.vence}`));
  if (conta && naJanela('conta', REGRAS.contaHora * 60, 12 * 60)) {
    opcoes.push({ tipo: 'conta', chave: `conta:${conta.id}:${conta.vence}`, dados: { conta: conta.descricao, valor: conta.valor, vence: conta.vence, hoje: dia } });
  }

  // Treino do plano de hoje: lembra no horário; se já registrou (app ou WhatsApp), às vezes só comemora.
  if (c.treinoHoje) {
    const alvo = horaDoTreino(c) * 60;
    if (!c.treinouHoje && !jaFoi(`treino:${dia}`) && naJanela('treino', alvo, alvo + 180)) {
      opcoes.push({ tipo: 'treino', chave: `treino:${dia}`, dados: { treino: c.treinoHoje.nome } });
    }
    if (c.treinouHoje && !jaFoi(`parabens:${dia}`) && conta7d(c, 'parabens') < REGRAS.parabensPorSemana
        && sorteio(c.telefone, dia, 'parabens') < REGRAS.parabensChance && naJanela('parabens', alvo, alvo + 240)) {
      opcoes.push({ tipo: 'parabens', chave: `parabens:${dia}`, dados: { treino: c.treinoHoje.nome } });
    }
  }

  // Check-in da noite: só se não lançou gasto hoje, no máximo 3x por semana, em dias sorteados.
  if (c.gastosHoje === 0 && !jaFoi(`checkin:${dia}`) && conta7d(c, 'checkin') < REGRAS.checkinPorSemana
      && sorteio(c.telefone, dia, 'checkin') < REGRAS.checkinChance && naJanela('checkin', REGRAS.checkinHora * 60, 21 * 60 + 45)) {
    opcoes.push({ tipo: 'checkin', chave: `checkin:${dia}`, dados: {} });
  }

  // Refeição: só com meta de alimentação, sem refeição registrada, no almoço, até 2x por semana.
  if (temMetaDieta(c) && c.refeicoesHoje === 0 && !jaFoi(`refeicao:${dia}`) && conta7d(c, 'refeicao') < REGRAS.refeicaoPorSemana
      && sorteio(c.telefone, dia, 'refeicao') < REGRAS.refeicaoChance
      && naJanela('refeicao', REGRAS.refeicaoHora * 60 + REGRAS.refeicaoMinuto, 14 * 60)) {
    opcoes.push({ tipo: 'refeicao', chave: `refeicao:${dia}`, dados: {} });
  }

  return opcoes[0] ?? null;
}

/** Converte um item do RPC `whatsapp_lembretes_candidatos` (migration 013). */
export function candidatoDoRpc(r: Record<string, unknown>): Candidato {
  const num = (v: unknown) => (v == null ? null : Number(v));
  const t = r.treino_hoje as { nome?: string; hora?: number | null } | null;
  return {
    telefone: String(r.telefone),
    nome: typeof r.nome === 'string' && r.nome ? r.nome : null,
    objetivo: typeof r.objetivo === 'string' ? r.objetivo : null,
    metas: Array.isArray(r.metas) ? (r.metas as Meta[]) : [],
    fatos: Array.isArray(r.fatos) ? (r.fatos as string[]).slice(-10) : [],
    estilo: { tamanho: r.estilo_tamanho === 'detalhado' ? 'detalhado' : 'curto', emoji: r.estilo_emoji !== false },
    lembreteHora: num(r.lembrete_hora),
    horaInferida: num(r.hora_inferida),
    enviosHoje: Number(r.envios_hoje ?? 0),
    enviosTotal: Number(r.envios_total ?? 0),
    enviosSemResposta: Number(r.envios_sem_resposta ?? 0),
    chaves7d: Array.isArray(r.chaves_7d) ? (r.chaves_7d as string[]) : [],
    treinoHoje: t?.nome ? { nome: t.nome, hora: num(t.hora) } : null,
    treinouHoje: r.treinou_hoje === true,
    gastosHoje: Number(r.gastos_hoje ?? 0),
    refeicoesHoje: Number(r.refeicoes_hoje ?? 0),
    contas: Array.isArray(r.contas) ? (r.contas as Candidato['contas']).map((k) => ({ ...k, valor: Number(k.valor) })) : [],
  };
}
