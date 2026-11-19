import 'server-only';
import type { IntencaoEscrita } from './intencao';

export interface RespostaRpc {
  ok: boolean;
  nome?: string | null;
  erro?: string;
  duplicada?: boolean;
}

/** Grava pelo RPC `whatsapp_registrar` (chave anon + segredo do webhook; o servidor não tem service role). */
export async function registrarNoBanco(telefone: string, mensagemId: string | null, i: IntencaoEscrita, fetchFn: typeof fetch = fetch): Promise<RespostaRpc> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const segredo = process.env.WHATSAPP_RPC_SEGREDO;
  if (!url || !anon || !segredo) return { ok: false, erro: 'nao_configurado' };
  const dados =
    i.tipo === 'refeicao'
      ? { tipo: i.refeicao, descricao: i.descricao, data: i.data }
      : i.tipo === 'treino'
        ? { descricao: i.descricao, duracao_min: i.duracao_min, data: i.data }
        : { valor: i.valor, descricao: i.descricao, categoria: i.categoria, data: i.data };
  try {
    const res = await fetchFn(`${url}/rest/v1/rpc/whatsapp_registrar`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', apikey: anon, authorization: `Bearer ${anon}` },
      body: JSON.stringify({ p_segredo: segredo, p_telefone: telefone, p_mensagem_id: mensagemId, p_tipo: i.tipo, p_dados: dados }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      console.warn(`[whatsapp] rpc status=${res.status}`);
      return { ok: false, erro: 'rpc_http' };
    }
    return (await res.json()) as RespostaRpc;
  } catch {
    console.warn('[whatsapp] rpc motivo=rede');
    return { ok: false, erro: 'rede' };
  }
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
