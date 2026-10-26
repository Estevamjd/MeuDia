import { classificarIntencao } from '@meudia/ai';
import type { PropostaGasto, RespostaIaChat } from './proposta';

const TIMEOUT_MS = 10_000;

/** Intenções que as regras já resolvem (navegação, atalhos, outros módulos) não gastam cota do modelo. */
const INTENCOES_IA = new Set(['CRIAR_TRANSACAO', 'GENERICA']);

export function deveConsultarIA(texto: string): boolean {
  if (texto.trim().endsWith('?') || !/\d/.test(texto)) return false;
  // O classificador compartilhado também usa "gastei" em CONSULTA_FINANCAS.
  // Relatos iniciados pelo verbo continuam elegíveis; perguntas ficam nas regras.
  if (/^(?:gastei|paguei|comprei)\b/i.test(texto.trim())) return true;
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
