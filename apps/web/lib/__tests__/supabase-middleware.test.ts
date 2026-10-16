import { afterEach, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { updateSession } from '../supabase/middleware';

vi.mock('@supabase/ssr', () => ({ createServerClient: vi.fn() }));
afterEach(() => vi.unstubAllEnvs());
it.each([
  ['/financas', null, '/login'],
  ['/login', { id: 'u' }, '/financas'],
  ['/treinos/sessao?mes=10', { id: 'u' }, '/financas'],
  ['/treinos?mes=10', { id: 'u' }, '/financas'],
] as const)('preserva cookies no redirect de %s', async (origem, user, destino) => {
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://example.invalid');
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'fixture');
  vi.stubEnv('APP_MODE', 'financas');
  vi.mocked(createServerClient).mockImplementation((_url, _key, options) => ({
    auth: { getUser: async () => {
      options.cookies.setAll!([{ name: 'session', value: 'renovada', options: { httpOnly: true, path: '/', sameSite: 'lax' } }]);
      return { data: { user } };
    } },
  }) as never);
  const response = await updateSession(new NextRequest(`https://example.invalid${origem}`));
  expect(new URL(response.headers.get('location')!).pathname).toBe(destino);
  expect(response.cookies.get('session')).toMatchObject({ value: 'renovada', httpOnly: true, path: '/', sameSite: 'lax' });
});

it.each(['/treinos', '/treinos/sessao?mes=10'])('bloqueia %s mesmo sem Supabase configurado', async path => {
  vi.stubEnv('APP_MODE', 'financas');
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', '');
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', '');
  const response = await updateSession(new NextRequest(`https://example.invalid${path}`));
  expect(response.headers.get('location')).toBe('https://example.invalid/financas');
});

it.each([null, { id: 'u' }])('/auth/callback é público e não redireciona (user=%o)', async user => {
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://example.invalid');
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'fixture');
  vi.stubEnv('APP_MODE', 'financas');
  vi.mocked(createServerClient).mockImplementation(() => ({
    auth: { getUser: async () => ({ data: { user } }) },
  }) as never);
  const response = await updateSession(new NextRequest('https://example.invalid/auth/callback?code=abc'));
  expect(response.headers.get('location')).toBeNull();
});
