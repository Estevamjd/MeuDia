import 'server-only';

/**
 * Cliente mínimo do Gemini (REST, plano grátis). Só roda no servidor: a chave `GEMINI_API_KEY`
 * nunca tem `NEXT_PUBLIC_` e nunca é logada. Qualquer falha devolve null (a rota cai no fallback).
 */

/**
 * Log de fallback com motivo curto e estável. Nunca recebe chave, URL, headers, mensagem do usuário
 * nem texto da resposta: só o motivo e, no HTTP, o status numérico e o `error.status` do Google.
 */
export function logFallback(motivo: string, extra = ''): void {
  console.warn(`[ia/chat] fallback motivo=${motivo}${extra ? ` ${extra}` : ''}`);
}

/** Só códigos no formato do Google (ex.: INVALID_ARGUMENT, RESOURCE_EXHAUSTED); o resto é descartado. */
async function codigoErroGoogle(res: Response): Promise<string | null> {
  try {
    const json = (await res.json()) as { error?: { status?: unknown } } | null;
    const status = json?.error?.status;
    return typeof status === 'string' && /^[A-Z_]{1,40}$/.test(status) ? status : null;
  } catch {
    return null;
  }
}

/** Padrão do STACK-DECISION §1; troca sem deploy pela env opcional `GEMINI_MODEL`. */
export const MODELO_PADRAO = 'gemini-3.1-flash-lite';
const TIMEOUT_MS = 8000;
const MAX_OUTPUT_TOKENS = 256;

export interface EntradaGemini {
  mensagem: string;
  categorias: readonly string[];
  carteiras: readonly string[];
  hojeISO: string;
}

/** O que o modelo pode fazer: só preencher o card. Nada de gravar nem calcular. */
const PROPOR_GASTO = {
  name: 'propor_gasto',
  description: 'Preenche o card de um gasto que a pessoa contou. Não grava nada: ela confirma depois.',
  parameters: {
    type: 'OBJECT',
    properties: {
      valor: { type: 'NUMBER', description: 'Valor em reais, positivo (ex.: 45 ou 12.5).' },
      categoria: { type: 'STRING', description: 'Uma das categorias da lista, escrita igual.' },
      descricao: { type: 'STRING', description: 'Descrição curta (ex.: "Mercado").' },
      data: { type: 'STRING', description: 'Data AAAA-MM-DD. Sem data na mensagem, use hoje.' },
      carteira: { type: 'STRING', description: 'Nome de uma das carteiras da lista, se a pessoa disser de onde saiu.' },
    },
    required: ['valor', 'categoria'],
  },
} as const;

/** A chave só é lida aqui (módulo server-only). Nunca logar nem devolver ao cliente. */
export function chaveGemini(): string | null {
  return process.env.GEMINI_API_KEY?.trim() || null;
}

export function modeloGemini(): string {
  return process.env.GEMINI_MODEL?.trim() || MODELO_PADRAO;
}

/** Thinking desligado (2.5) ou no mínimo (3.x). */
function configThinking(modelo: string) {
  return modelo.startsWith('gemini-2.5') ? { thinkingBudget: 0 } : { thinkingLevel: 'minimal' };
}

/** Só o mínimo vai ao modelo: mensagem, categorias, nomes das carteiras e a data de hoje. */
export function montarRequisicao(entrada: EntradaGemini, modelo = modeloGemini()) {
  const instrucao = [
    'Você ajuda a anotar gastos em reais (pt-BR).',
    `Hoje é ${entrada.hojeISO} (America/Sao_Paulo).`,
    `Categorias: ${entrada.categorias.join(', ')}.`,
    `Carteiras: ${entrada.carteiras.length ? entrada.carteiras.join(', ') : '(nenhuma)'}.`,
    'Se a mensagem contar um gasto, chame propor_gasto. Se não for um gasto, não chame nenhuma função.',
  ].join('\n');
  return {
    systemInstruction: { parts: [{ text: instrucao }] },
    contents: [{ role: 'user', parts: [{ text: entrada.mensagem }] }],
    tools: [{ functionDeclarations: [PROPOR_GASTO] }],
    toolConfig: { functionCallingConfig: { mode: 'AUTO' } },
    generationConfig: { temperature: 0, maxOutputTokens: MAX_OUTPUT_TOKENS, thinkingConfig: configThinking(modelo) },
  };
}

/**
 * Pede ao Gemini os argumentos de `propor_gasto`. Devolve os args crus (o servidor valida com zod)
 * ou null em erro, timeout, cota (429) ou quando o modelo não chamou a função.
 */
export async function chamarProporGasto(entrada: EntradaGemini, chave: string): Promise<unknown | null> {
  const modelo = modeloGemini();
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelo)}:generateContent`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': chave },
        body: JSON.stringify(montarRequisicao(entrada, modelo)),
        signal: AbortSignal.timeout(TIMEOUT_MS),
        cache: 'no-store',
      },
    );
    if (!res.ok) {
      const codigo = await codigoErroGoogle(res);
      logFallback('gemini_http', `status=${res.status}${codigo ? ` erro=${codigo}` : ''}`);
      return null;
    }
    const json = (await res.json()) as {
      candidates?: { content?: { parts?: { functionCall?: { name?: string; args?: unknown } }[] } }[];
    };
    const chamada = json.candidates?.[0]?.content?.parts?.find((p) => p.functionCall?.name === PROPOR_GASTO.name);
    if (!chamada?.functionCall?.args) {
      logFallback('gemini_sem_funcao');
      return null;
    }
    return chamada.functionCall.args;
  } catch (e) {
    // Só o nome do erro decide o motivo; a mensagem pode carregar a requisição.
    const nome = e instanceof Error ? e.name : '';
    logFallback(nome === 'TimeoutError' || nome === 'AbortError' ? 'gemini_timeout' : nome === 'TypeError' ? 'gemini_rede' : 'excecao');
    return null;
  }
}
