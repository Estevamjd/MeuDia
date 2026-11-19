/**
 * Recuperação de senha ("Esqueceu a senha?").
 *
 * O pedido usa o fluxo implícito do Supabase: o link do e-mail volta para /nova-senha com os tokens no `#`.
 * Funciona mesmo quando a pessoa pede no celular e abre o e-mail em outro navegador (o PKCE exigiria o mesmo navegador).
 * A página também aceita `?code=` (PKCE) e `?token_hash=` (template de e-mail com TokenHash), caso a config mude.
 */
export const NOVA_SENHA_PATH = '/nova-senha';
export const ESQUECI_SENHA_PATH = '/esqueci-senha';
/** Marca na aba que o link de recuperação já foi aceito (recarregar a página não perde o formulário). */
export const CHAVE_RECUPERACAO = 'meudia:recuperacao-senha';

export const MENSAGEM_PEDIDO_ENVIADO =
  'Se existir uma conta com esse e-mail, você vai receber um link para criar uma nova senha. Confira também o spam.';

export function getResetRedirectUrl(origin: string): string {
  return `${origin.replace(/\/+$/, '')}${NOVA_SENHA_PATH}`;
}

export type ParametrosRecuperacao =
  | { tipo: 'implicito'; accessToken: string; refreshToken: string }
  | { tipo: 'codigo'; code: string }
  | { tipo: 'token_hash'; tokenHash: string }
  | { tipo: 'erro'; codigo: string }
  | { tipo: 'nenhum' };

/** Lê o que o Supabase mandou na URL do link (hash do fluxo implícito, `?code=` ou `?token_hash=`). */
export function lerParametrosRecuperacao(hash: string, search: string): ParametrosRecuperacao {
  const h = new URLSearchParams(hash.replace(/^#/, ''));
  const q = new URLSearchParams(search.replace(/^\?/, ''));
  const erro = h.get('error_code') ?? h.get('error') ?? q.get('error_code') ?? q.get('error');
  if (erro) return { tipo: 'erro', codigo: erro };
  const accessToken = h.get('access_token');
  const refreshToken = h.get('refresh_token');
  if (accessToken && refreshToken) return { tipo: 'implicito', accessToken, refreshToken };
  const tokenHash = q.get('token_hash');
  if (tokenHash && (q.get('type') ?? 'recovery') === 'recovery') return { tipo: 'token_hash', tokenHash };
  const code = q.get('code');
  if (code) return { tipo: 'codigo', code };
  return { tipo: 'nenhum' };
}

/** Link de recuperação que caiu na raiz ou no /login (Site URL sem a lista de redirects): manda para /nova-senha. */
export function destinoSeLinkDeRecuperacao(hash: string): string | null {
  const h = new URLSearchParams(hash.replace(/^#/, ''));
  if (h.get('type') !== 'recovery') return null;
  return `${NOVA_SENHA_PATH}${hash.startsWith('#') ? hash : `#${hash}`}`;
}

type ErroAuth = { message?: string; code?: string; status?: number } | null | undefined;

function limiteExcedido(error: ErroAuth): boolean {
  return error?.status === 429 || error?.code === 'over_email_send_rate_limit' || error?.code === 'over_request_rate_limit';
}

/**
 * Resultado do pedido de link. Nunca diz se o e-mail tem conta: sucesso e "e-mail sem conta" mostram a mesma mensagem.
 * Só o limite de envio e a falha de rede/servidor viram aviso (a pessoa precisa saber que o e-mail não saiu).
 */
export function resultadoPedido(error: ErroAuth): { ok: boolean; mensagem: string } {
  if (!error) return { ok: true, mensagem: MENSAGEM_PEDIDO_ENVIADO };
  if (limiteExcedido(error)) {
    return { ok: false, mensagem: 'Muitos pedidos em pouco tempo. Aguarde alguns minutos e tente de novo.' };
  }
  if (error.code === 'email_address_invalid' || error.code === 'validation_failed') {
    return { ok: false, mensagem: 'Confira se o e-mail está certo.' };
  }
  if (error.code === 'user_not_found') return { ok: true, mensagem: MENSAGEM_PEDIDO_ENVIADO };
  return { ok: false, mensagem: 'Não deu para enviar o e-mail agora. Tente de novo em alguns minutos.' };
}

export const MENSAGEM_LINK_INVALIDO =
  'Este link não vale mais: ele expira e só pode ser usado uma vez. Peça um novo link abaixo.';

export function mensagemErroNovaSenha(error: ErroAuth): string {
  if (error?.code === 'same_password') return 'A nova senha precisa ser diferente da anterior.';
  if (error?.code === 'weak_password') return 'Essa senha é fraca. Use pelo menos 8 caracteres, com letras e números.';
  if (error?.code === 'session_not_found' || error?.code === 'session_expired' || error?.status === 401 || error?.status === 403) {
    return MENSAGEM_LINK_INVALIDO;
  }
  if (limiteExcedido(error)) return 'Muitas tentativas. Aguarde alguns minutos e tente de novo.';
  return 'Não deu para salvar a nova senha. Tente de novo.';
}
