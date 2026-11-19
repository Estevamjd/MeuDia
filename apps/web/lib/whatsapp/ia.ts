import 'server-only';

/**
 * Cliente mínimo da API da Anthropic (Claude Haiku 4.5). Sem `ANTHROPIC_API_KEY` não chama nada.
 * Tokens limitados por chamada e log de custo (nunca loga chave, mensagem nem resposta).
 */
export const MODELO_CLAUDE_PADRAO = 'claude-haiku-4-5';
const TIMEOUT_MS = 8000;
// Preço do Haiku 4.5 (US$ por milhão de tokens).
const PRECO_ENTRADA = 1;
const PRECO_SAIDA = 5;

export interface PedidoClaude {
  uso: 'interpretar' | 'onboarding' | 'conversa' | 'comentario';
  system: string;
  mensagem: string;
  maxTokens: number;
  ferramenta?: { name: string; description: string; input_schema: Record<string, unknown> };
}

export type RespostaClaude = { tipo: 'ferramenta'; input: unknown } | { tipo: 'texto'; texto: string };

export function custoUSD(entrada: number, saida: number): number {
  return (entrada * PRECO_ENTRADA + saida * PRECO_SAIDA) / 1_000_000;
}

export async function chamarClaude(p: PedidoClaude, fetchFn: typeof fetch = fetch): Promise<RespostaClaude | null> {
  const chave = process.env.ANTHROPIC_API_KEY;
  if (!chave) return null;
  try {
    const res = await fetchFn('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': chave, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: process.env.WHATSAPP_IA_MODELO || MODELO_CLAUDE_PADRAO,
        max_tokens: p.maxTokens,
        system: p.system,
        ...(p.ferramenta ? { tools: [p.ferramenta], tool_choice: { type: 'tool', name: p.ferramenta.name } } : {}),
        messages: [{ role: 'user', content: p.mensagem.slice(0, 500) }],
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) {
      console.warn(`[whatsapp/ia] uso=${p.uso} fallback status=${res.status}`);
      return null;
    }
    const json = (await res.json()) as {
      content?: { type: string; input?: unknown; text?: string }[];
      usage?: { input_tokens?: number; output_tokens?: number };
    };
    const ent = json.usage?.input_tokens ?? 0;
    const sai = json.usage?.output_tokens ?? 0;
    // eslint-disable-next-line no-console -- log de custo (só contagem de tokens, sem texto do usuário).
    console.info(`[whatsapp/ia] uso=${p.uso} in=${ent} out=${sai} custo_usd=${custoUSD(ent, sai).toFixed(5)}`);
    if (p.ferramenta) {
      const uso = json.content?.find((c) => c.type === 'tool_use');
      return uso ? { tipo: 'ferramenta', input: uso.input } : null;
    }
    const texto = (json.content ?? []).filter((c) => c.type === 'text').map((c) => c.text ?? '').join('').trim();
    return texto ? { tipo: 'texto', texto } : null;
  } catch {
    console.warn(`[whatsapp/ia] uso=${p.uso} fallback motivo=rede`);
    return null;
  }
}
