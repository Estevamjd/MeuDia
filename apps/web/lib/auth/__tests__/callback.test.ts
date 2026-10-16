import { describe, it, expect } from 'vitest';
import {
  getAuthCallbackUrl,
  getSafeNextPath,
  resolveSafeRedirectUrl,
  isEmailNotConfirmedError,
  getResendErrorMessage,
} from '../callback';

describe('getAuthCallbackUrl', () => {
  it('usa a origem informada', () => {
    expect(getAuthCallbackUrl('http://localhost:3000')).toBe('http://localhost:3000/auth/callback');
  });

  it('usa o fallback de produção fora do navegador', () => {
    expect(getAuthCallbackUrl()).toBe('https://meudia.vercel.app/auth/callback');
  });
});

describe('getSafeNextPath', () => {
  it('aceita caminhos relativos', () => {
    expect(getSafeNextPath('/financas')).toBe('/financas');
  });

  it('aceita query string e hash', () => {
    expect(getSafeNextPath('/financas?mes=10#topo')).toBe('/financas?mes=10#topo');
  });

  it.each([
    null,
    undefined,
    '',
    'financas',
    '//evil.com',
    '/\\evil.com',
    '\\\\evil.com',
    '/foo\\bar',
    '/\t/evil.com',
    '/\r/evil.com',
    '/\n/evil.com',
    '/ /evil.com',
    '/\u0000/evil.com',
    'https://evil.com',
    'javascript:alert(1)',
    ' /financas',
  ])('rejeita %j', (next) => {
    expect(getSafeNextPath(next)).toBeNull();
  });

  it('rejeita tab vindo de query string decodificada (%09)', () => {
    const next = new URLSearchParams('next=/%09/evil.com').get('next');
    expect(getSafeNextPath(next)).toBeNull();
  });
});

describe('resolveSafeRedirectUrl', () => {
  const origin = 'https://meudia.vercel.app';

  it('resolve caminhos relativos na mesma origem', () => {
    expect(resolveSafeRedirectUrl('/financas?x=1', origin)?.href).toBe(
      'https://meudia.vercel.app/financas?x=1',
    );
  });

  it.each([
    '/\t/evil.com',
    '/\r/evil.com',
    '/\n/evil.com',
    '/\\evil.com',
    '//evil.com',
    'https://evil.com',
    'http://meudia.vercel.app.evil.com/',
    null,
  ])('rejeita %j', (next) => {
    expect(resolveSafeRedirectUrl(next, origin)).toBeNull();
  });
});

describe('isEmailNotConfirmedError', () => {
  it('reconhece pela mensagem ou pelo código', () => {
    expect(isEmailNotConfirmedError({ message: 'Email not confirmed' })).toBe(true);
    expect(isEmailNotConfirmedError({ code: 'email_not_confirmed' })).toBe(true);
    expect(isEmailNotConfirmedError({ message: 'Invalid login credentials' })).toBe(false);
    expect(isEmailNotConfirmedError(null)).toBe(false);
  });
});

describe('getResendErrorMessage', () => {
  it('mostra mensagem de limite para 429', () => {
    expect(getResendErrorMessage({ status: 429 })).toMatch(/Aguarde/);
  });

  it('mostra mensagem genérica nos demais casos', () => {
    expect(getResendErrorMessage({ status: 500 })).toMatch(/Não foi possível/);
  });
});
