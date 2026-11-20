import 'server-only';
import type { IntencaoEscrita } from './intencao';

export interface Extras {
  categoria?: string;
  planejado?: number;
  gasto_mes?: number;
  conta_paga?: string;
  valor_registrado?: number;
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
        : { valor: i.valor, descricao: i.descricao, categoria: i.categoria, data: i.data, ...(i.pagar ? { pagar: true } : {}) };
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

// ── Lembretes proativos (migration 013) ──

export function buscarCandidatos(agora: Date | null, fetchFn: typeof fetch = fetch) {
  return rpc<{ ok: boolean; erro?: string; hoje?: string; candidatos?: Record<string, unknown>[] }>(
    'whatsapp_lembretes_candidatos', { p_agora: agora ? agora.toISOString() : null }, fetchFn);
}

export function reservarLembrete(telefone: string, tipo: string, chave: string, fetchFn: typeof fetch = fetch) {
  return rpc<{ ok: boolean; erro?: string; id?: number }>('whatsapp_lembrete_reservar', { p_telefone: telefone, p_tipo: tipo, p_chave: chave }, fetchFn);
}

export function marcarLembrete(id: number, status: 'enviado' | 'falhou', fetchFn: typeof fetch = fetch) {
  return rpc<{ ok: boolean; erro?: string }>('whatsapp_lembrete_status', { p_id: id, p_status: status }, fetchFn);
}

/** "parar lembretes" / "voltar lembretes" / "lembretes às 19h". */
export function configurarLembretes(telefone: string, ativos: boolean | null, hora: number | null, fetchFn: typeof fetch = fetch) {
  return rpc<{ ok: boolean; erro?: string; lembretes_ativos?: boolean; lembrete_hora?: number | null }>(
    'whatsapp_lembretes_config', { p_telefone: telefone, p_ativos: ativos, p_hora: hora }, fetchFn);
}

const waha = () => {
  const base = process.env.WAHA_URL;
  const chave = process.env.WAHA_API_KEY;
  return base && chave ? { base: base.replace(/\/$/, ''), headers: { 'content-type': 'application/json', 'x-api-key': chave }, sessao: process.env.WAHA_SESSAO || 'default' } : null;
};

/** Status da sessão do WAHA (WORKING = conectada). Sem sessão, os lembretes não enviam nada. */
export async function statusSessao(fetchFn: typeof fetch = fetch): Promise<string> {
  const w = waha();
  if (!w) return 'NAO_CONFIGURADO';
  try {
    const res = await fetchFn(`${w.base}/api/sessions/${w.sessao}`, { headers: w.headers, signal: AbortSignal.timeout(5000) });
    if (!res.ok) return `HTTP_${res.status}`;
    const j = (await res.json()) as { status?: string };
    return j.status ?? 'DESCONHECIDO';
  } catch {
    return 'REDE';
  }
}

/** "digitando…" antes de mandar (recomendação do WAHA para parecer conversa humana). Melhor esforço. */
export async function digitando(chatId: string, ligar: boolean, fetchFn: typeof fetch = fetch): Promise<void> {
  const w = waha();
  if (!w) return;
  try {
    await fetchFn(`${w.base}/api/${ligar ? 'startTyping' : 'stopTyping'}`, {
      method: 'POST', headers: w.headers, body: JSON.stringify({ session: w.sessao, chatId }), signal: AbortSignal.timeout(5000),
    });
  } catch { /* opcional */ }
}

/** Apenas o último registro feito pelo WhatsApp nos últimos 30 minutos (016). */
export function desfazerUltimo(telefone: string, mensagemId: string | null, fetchFn: typeof fetch = fetch) {
  return rpc<{ ok: boolean; erro?: string; duplicada?: boolean; desfeito?: boolean; ja_desfeito?: boolean; ja_apagado?: boolean; descricao?: string; valor?: number | null }>(
    'whatsapp_desfazer', { p_telefone: telefone, p_mensagem_id: mensagemId }, fetchFn);
}

/** Melhor esforço; a própria função SQL garante idempotência diária. */
export function executarManutencaoDiaria(fetchFn: typeof fetch = fetch) {
  return rpc<{ ok: boolean; erro?: string }>('whatsapp_manutencao_diaria', {}, fetchFn);
}
