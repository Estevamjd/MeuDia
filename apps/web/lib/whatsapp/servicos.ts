import 'server-only';
import type { IntencaoEscrita } from './intencao';

export interface Extras {
  categoria?: string;
  planejado?: number;
  gasto_mes?: number;
  conta_descricao?: string;
  conta_valor?: number;
  conta_dia?: number;
  treinos_semana?: number;
  refeicoes_dia?: number;
  /** Últimos 5 registros de 7 dias, mais novo primeiro (012). */
  recentes?: { tipo: 'gasto' | 'treino' | 'refeicao'; descricao?: string; valor?: number; data?: string }[];
  /** Treino: dias desde o treino anterior (012); ausente se é o primeiro. */
  dias_sem_treino?: number | null;
}

export interface RespostaRpc {
  ok: boolean;
  nome?: string | null;
  erro?: string;
  duplicada?: boolean;
  extras?: Extras;
}

/** POST /rest/v1/rpc/<fn> com a chave anon (as funções exigem o segredo do webhook). */
async function rpc<T extends { ok: boolean; erro?: string }>(fn: string, corpo: Record<string, unknown>, fetchFn: typeof fetch): Promise<T> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const segredo = process.env.WHATSAPP_RPC_SEGREDO;
  if (!url || !anon || !segredo) return { ok: false, erro: 'nao_configurado' } as T;
  try {
    const res = await fetchFn(`${url}/rest/v1/rpc/${fn}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', apikey: anon, authorization: `Bearer ${anon}` },
      body: JSON.stringify({ p_segredo: segredo, ...corpo }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      console.warn(`[whatsapp] rpc=${fn} status=${res.status}`);
      return { ok: false, erro: 'rpc_http' } as T;
    }
    return (await res.json()) as T;
  } catch {
    console.warn(`[whatsapp] rpc=${fn} motivo=rede`);
    return { ok: false, erro: 'rede' } as T;
  }
}

/** Conta a mensagem do dia e devolve o estado do número (whatsapp_contato, 011). */
export function buscarContato(telefone: string, limite: number, fetchFn: typeof fetch = fetch) {
  return rpc<{ ok: boolean; erro?: string } & Record<string, unknown>>('whatsapp_contato', { p_telefone: telefone, p_limite: limite }, fetchFn);
}

/** Grava respostas do onboarding; com `gerarToken` devolve o token do link (whatsapp_onboarding, 011). */
export function salvarOnboarding(telefone: string, dados: Record<string, unknown>, gerarToken: boolean, fetchFn: typeof fetch = fetch) {
  return rpc<{ ok: boolean; erro?: string; token?: string }>('whatsapp_onboarding', { p_telefone: telefone, p_dados: dados, p_gerar_token: gerarToken }, fetchFn);
}

/** Guarda um fato que a pessoa pediu para lembrar; `null` esquece todos (whatsapp_lembrar, 012). */
export function lembrarFato(telefone: string, fato: string | null, fetchFn: typeof fetch = fetch) {
  return rpc<{ ok: boolean; erro?: string; total?: number }>('whatsapp_lembrar', { p_telefone: telefone, p_fato: fato }, fetchFn);
}

/** Grava pelo RPC `whatsapp_registrar` (chave anon + segredo do webhook; o servidor não tem service role). */
export function registrarNoBanco(telefone: string, mensagemId: string | null, i: IntencaoEscrita, fetchFn: typeof fetch = fetch): Promise<RespostaRpc> {
  const dados =
    i.tipo === 'refeicao'
      ? { tipo: i.refeicao, descricao: i.descricao, data: i.data }
      : i.tipo === 'treino'
        ? { descricao: i.descricao, duracao_min: i.duracao_min, data: i.data }
        : { valor: i.valor, descricao: i.descricao, categoria: i.categoria, data: i.data };
  return rpc<RespostaRpc>('whatsapp_registrar', { p_telefone: telefone, p_mensagem_id: mensagemId, p_tipo: i.tipo, p_dados: dados }, fetchFn);
}

/** Responde pelo WAHA (`POST /api/sendText`). Só responde a quem escreveu; nada de envio em massa. */
export async function responder(chatId: string, texto: string, fetchFn: typeof fetch = fetch): Promise<boolean> {
  const base = process.env.WAHA_URL;
  const chave = process.env.WAHA_API_KEY;
  if (!base || !chave) return false;
  try {
    const res = await fetchFn(`${base.replace(/\/$/, '')}/api/sendText`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': chave },
      body: JSON.stringify({ session: process.env.WAHA_SESSAO || 'default', chatId, text: texto }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) console.warn(`[whatsapp] waha status=${res.status}`);
    return res.ok;
  } catch {
    console.warn('[whatsapp] waha motivo=rede');
    return false;
  }
}
