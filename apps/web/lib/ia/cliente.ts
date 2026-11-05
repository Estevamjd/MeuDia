import { classificarIntencao } from '@meudia/ai';
import type { PropostaGasto, RespostaIaChat } from './proposta';

const TIMEOUT_MS = 10_000;

/** Intenções que as regras já resolvem (navegação, atalhos, outros módulos) não gastam cota do modelo. */
const INTENCOES_IA = new Set(['CRIAR_TRANSACAO', 'GENERICA']);

/** Pergunta com ou sem "?" ("quanto gastei 45 hoje") fica nas regras. */
const PERGUNTA = /\?$|^(?:quanto|quantos|quantas|qual|quais|como|quando|onde|por ?que|o que)\b/;
const VERBO_GASTO = /^(?:gastei|paguei|comprei)\b/;
/** "32 reais", "R$ 50", "18,90": valor em dinheiro explícito, sem verbo. */
const VALOR_MONETARIO = /r\$\s*\d|\d\s*(?:reais|real|contos?|pilas?)\b|\d[.,]\d{2}\b/;
/**
 * Agenda, tarefa, treino ou hábito: número de hora, dia, quantidade ou palavra do módulo.
 * Texto sem acento (normalizado) para o \b funcionar.
 */
const NAO_GASTO = new RegExp(
  [
    /\b(?:tarefa|lembr|agend|marc(?:a|ar|ue)\b|reuniao|compromisso|evento|treino|treinar|academia|exercicio|habito|rotina)/,
    /\bas \d|\b\d{1,2}(?::\d{2}|h\d{0,2})\b|\bdia \d/,
    /\d\s*(?:hs?|horas?|min|minutos?|km|kg|l|litros?|ml|paginas?|vezes|x|dias?|semanas?|meses|anos?|copos?|passos|series|reps?|%)(?:\s|$|[.,!])/,
  ]
    .map((r) => r.source)
    .join('|'),
);

const normalizar = (texto: string) =>
  texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

/**
 * F1 só consulta a IA para relato de gasto com valor. Perguntas, agenda/tarefa/treino/hábito e texto
 * sem número ficam nas regras e não gastam cota.
 */
export function deveConsultarIA(texto: string): boolean {
  const t = normalizar(texto);
  if (PERGUNTA.test(t) || !/\d/.test(t)) return false;
  // O classificador compartilhado também usa "gastei" em CONSULTA_FINANCAS.
  // Relatos iniciados pelo verbo continuam elegíveis; perguntas ficam nas regras.
  if (VERBO_GASTO.test(t)) return true;
  if (NAO_GASTO.test(t)) return false;
  if (VALOR_MONETARIO.test(t)) return true;
  // Número solto ("mercado 120", "recebi 100"): só se o classificador não vir outro módulo.
  return INTENCOES_IA.has(classificarIntencao(texto).tipo);
}

/**
 * Preserva a confirmação de gravação mesmo sem card; falhas de transporte retornam null.
 */
export async function pedirPropostaIA(mensagem: string, fetchImpl: typeof fetch = fetch): Promise<{ gravada: boolean; proposta: PropostaGasto | null } | null> {
  try {
    const res = await fetchImpl('/api/ia/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mensagem }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as RespostaIaChat;
    return { gravada: json?.gravada === true, proposta: json?.fallback === false ? json.proposta : null };
  } catch {
    return null;
  }
}
