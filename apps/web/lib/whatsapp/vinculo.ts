/** Link do WhatsApp (/whatsapp?t=TOKEN): guarda o token até a pessoa entrar/criar a conta e liga pelo RPC. */
import type { SupabaseClient } from '@supabase/supabase-js';

export const CHAVE_TOKEN = 'meudia:whatsapp-token';
const RE_TOKEN = /^[0-9a-f]{64}$/;

export function tokenValido(t: string | null | undefined): t is string {
  return !!t && RE_TOKEN.test(t);
}

export function guardarToken(t: string) {
  try { localStorage.setItem(CHAVE_TOKEN, t); } catch { /* modo privado */ }
}

export function tokenGuardado(): string | null {
  try {
    const t = localStorage.getItem(CHAVE_TOKEN);
    return tokenValido(t) ? t : null;
  } catch {
    return null;
  }
}

export function esquecerToken() {
  try { localStorage.removeItem(CHAVE_TOKEN); } catch { /* nada */ }
}

export type ResultadoVinculo = { ok: true } | { ok: false; motivo: 'expirado' | 'numero_em_uso' | 'falhou' };

export async function vincularWhatsapp(supabase: SupabaseClient, token: string): Promise<ResultadoVinculo> {
  const { data, error } = await supabase.rpc('whatsapp_vincular', { p_token: token });
  if (error) return { ok: false, motivo: 'falhou' };
  const r = (data ?? {}) as { ok?: boolean; erro?: string };
  if (r.ok) return { ok: true };
  if (r.erro === 'numero_em_uso') return { ok: false, motivo: 'numero_em_uso' };
  if (r.erro === 'token_invalido') return { ok: false, motivo: 'expirado' };
  return { ok: false, motivo: 'falhou' };
}

export const MENSAGEM_VINCULO: Record<Exclude<ResultadoVinculo, { ok: true }>['motivo'], string> = {
  expirado: 'Esse link expirou ou já foi usado. Mande "oi" no WhatsApp que eu te mando outro.',
  numero_em_uso: 'Esse WhatsApp já está ligado a outra conta do MeuDia.',
  falhou: 'Não consegui ligar o WhatsApp agora. Tente de novo em instantes.',
};
