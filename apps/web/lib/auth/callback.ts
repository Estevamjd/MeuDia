export const AUTH_CALLBACK_PATH = '/auth/callback';
export const FALLBACK_SITE_URL = 'https://meudia.vercel.app';

/** URL absoluta para onde o Supabase redireciona após a confirmação de e-mail. */
export function getAuthCallbackUrl(origin?: string): string {
  const base =
    origin ?? (typeof window !== 'undefined' ? window.location.origin : FALLBACK_SITE_URL);
  return `${base}${AUTH_CALLBACK_PATH}`;
}

// Caracteres de controle, espaços e barras invertidas: o parser de URL descarta/normaliza
// alguns deles (ex.: "/\t/evil.com" vira "//evil.com"), abrindo brecha para open redirect.
// eslint-disable-next-line no-control-regex
const UNSAFE_PATH_CHARS = /[\u0000-\u001F\u007F-\u009F\s\\]/;

/** Aceita apenas caminhos relativos ao próprio site (evita open redirect). */
export function getSafeNextPath(next: string | null | undefined): string | null {
  if (!next || UNSAFE_PATH_CHARS.test(next) || !next.startsWith('/') || next.startsWith('//')) {
    return null;
  }
  return next;
}

/**
 * Resolve `next` contra `origin` e só devolve a URL se ela continuar na mesma origem.
 * Defesa em profundidade sobre `getSafeNextPath`.
 */
export function resolveSafeRedirectUrl(
  next: string | null | undefined,
  origin: string,
): URL | null {
  const path = getSafeNextPath(next);
  if (!path) return null;
  try {
    const url = new URL(path, origin);
    return url.origin === new URL(origin).origin ? url : null;
  } catch {
    return null;
  }
}

type AuthErrorLike = { message?: string; code?: string; status?: number } | null | undefined;

export function isEmailNotConfirmedError(error: AuthErrorLike): boolean {
  return error?.code === 'email_not_confirmed' || error?.message === 'Email not confirmed';
}

export function getResendErrorMessage(error: AuthErrorLike): string {
  if (error?.status === 429) {
    return 'Muitas tentativas. Aguarde alguns minutos antes de reenviar.';
  }
  return 'Não foi possível reenviar o e-mail. Tente novamente.';
}
