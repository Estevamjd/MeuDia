import { classificarIntencao } from '@meudia/ai';
import type { PropostaGasto, RespostaIaChat } from './proposta';

const TIMEOUT_MS = 10_000;

/** Intenções que as regras já resolvem (navegação, atalhos, outros módulos) não gastam cota do modelo. */
const INTENCOES_IA = new Set(['CRIAR_TRANSACAO', 'CONSULTA_FINANCAS', 'GENERICA']);

export function deveConsultarIA(texto: string): boolean {
  return INTENCOES_IA.has(classificarIntencao(texto).tipo);
}

/**
 * Pede o card à rota de servidor. Qualquer coisa que não seja um card válido (fallback, 401, rede, timeout)
 * vira null, e quem chama segue com `processarMensagem()`, sem erro na tela.
 */
export async function pedirPropostaIA(mensagem: string, fetchImpl: typeof fetch = fetch): Promise<PropostaGasto | null> {
  try {
    const res = await fetchImpl('/api/ia/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mensagem }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as RespostaIaChat;
    return json && json.fallback === false && json.proposta ? json.proposta : null;
  } catch {
    return null;
  }
}
