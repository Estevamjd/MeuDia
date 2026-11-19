import { describe, expect, it } from 'vitest';
import {
  MENSAGEM_LINK_INVALIDO,
  MENSAGEM_PEDIDO_ENVIADO,
  destinoSeLinkDeRecuperacao,
  getResetRedirectUrl,
  lerParametrosRecuperacao,
  mensagemErroNovaSenha,
  resultadoPedido,
} from '../recuperacao';

describe('getResetRedirectUrl', () => {
  it('aponta para /nova-senha no próprio host', () => {
    expect(getResetRedirectUrl('https://meudia.srv2176785.hstgr.cloud')).toBe('https://meudia.srv2176785.hstgr.cloud/nova-senha');
    expect(getResetRedirectUrl('http://localhost:3000/')).toBe('http://localhost:3000/nova-senha');
  });
});

describe('lerParametrosRecuperacao', () => {
  it('fluxo implícito: tokens no hash', () => {
    expect(lerParametrosRecuperacao('#access_token=a&expires_in=3600&refresh_token=r&token_type=bearer&type=recovery', '')).toEqual({
      tipo: 'implicito', accessToken: 'a', refreshToken: 'r',
    });
  });
  it('link vencido ou já usado vira erro', () => {
    expect(lerParametrosRecuperacao('#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid', '')).toEqual({
      tipo: 'erro', codigo: 'otp_expired',
    });
    expect(lerParametrosRecuperacao('', '?error=access_denied')).toEqual({ tipo: 'erro', codigo: 'access_denied' });
  });
  it('PKCE (?code=) e template com token_hash', () => {
    expect(lerParametrosRecuperacao('', '?code=abc')).toEqual({ tipo: 'codigo', code: 'abc' });
    expect(lerParametrosRecuperacao('', '?token_hash=h&type=recovery')).toEqual({ tipo: 'token_hash', tokenHash: 'h' });
    expect(lerParametrosRecuperacao('', '?token_hash=h&type=signup')).toEqual({ tipo: 'nenhum' });
  });
  it('sem nada na URL', () => {
    expect(lerParametrosRecuperacao('', '')).toEqual({ tipo: 'nenhum' });
    expect(lerParametrosRecuperacao('#access_token=a', '')).toEqual({ tipo: 'nenhum' });
  });
});

describe('destinoSeLinkDeRecuperacao', () => {
  it('só desvia hash de recuperação, mantendo os tokens', () => {
    expect(destinoSeLinkDeRecuperacao('#access_token=a&refresh_token=r&type=recovery')).toBe('/nova-senha#access_token=a&refresh_token=r&type=recovery');
    expect(destinoSeLinkDeRecuperacao('#access_token=a&type=signup')).toBeNull();
    expect(destinoSeLinkDeRecuperacao('')).toBeNull();
  });
});

describe('resultadoPedido (não revela se o e-mail tem conta)', () => {
  it('sucesso e e-mail sem conta mostram a mesma mensagem', () => {
    expect(resultadoPedido(null)).toEqual({ ok: true, mensagem: MENSAGEM_PEDIDO_ENVIADO });
    expect(resultadoPedido({ code: 'user_not_found', status: 400 })).toEqual({ ok: true, mensagem: MENSAGEM_PEDIDO_ENVIADO });
    expect(MENSAGEM_PEDIDO_ENVIADO).toMatch(/^Se existir uma conta/);
  });
  it('limite de envio pede para esperar', () => {
    expect(resultadoPedido({ status: 429, code: 'over_email_send_rate_limit' }).mensagem).toMatch(/Aguarde alguns minutos/);
    expect(resultadoPedido({ status: 429 }).ok).toBe(false);
  });
  it('e-mail inválido e falha genérica', () => {
    expect(resultadoPedido({ code: 'email_address_invalid', status: 400 }).mensagem).toBe('Confira se o e-mail está certo.');
    expect(resultadoPedido({ status: 500, message: 'Error sending recovery email' }).mensagem).toMatch(/Não deu para enviar/);
  });
});

describe('mensagemErroNovaSenha', () => {
  it('traduz os erros do Supabase', () => {
    expect(mensagemErroNovaSenha({ code: 'same_password' })).toBe('A nova senha precisa ser diferente da anterior.');
    expect(mensagemErroNovaSenha({ code: 'weak_password' })).toMatch(/fraca/);
    expect(mensagemErroNovaSenha({ code: 'session_not_found' })).toBe(MENSAGEM_LINK_INVALIDO);
    expect(mensagemErroNovaSenha({ status: 401 })).toBe(MENSAGEM_LINK_INVALIDO);
    expect(mensagemErroNovaSenha({ status: 429 })).toMatch(/Aguarde/);
    expect(mensagemErroNovaSenha({ status: 500 })).toBe('Não deu para salvar a nova senha. Tente de novo.');
  });
});
