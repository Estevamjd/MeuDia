import { expect, it } from 'vitest';
import type { ErrorEvent, Event } from '@sentry/nextjs';
import { beforeBreadcrumb, sanitizarErroParaSentry, sentryPrivacy } from '../sentry-scrub';

it.each([
  'at GET (/app/api/[id]/route.ts:12:3)',
  'at Page (/app/(dashboard)/page.tsx:12:3)',
  'at async GET (/app/api/route.ts:12:3)',
  'at new X (/app/model.ts:12:3)',
  'at GET (file:///app/route.ts:12:3)',
  'at file:///app/route.ts:12:3',
  'at GET (https://host/route.ts?token=segredo#privado:12:3)',
])('mantém frame %s removendo query e fragment', (frame) => {
  const error = new Error('PII');
  error.stack = `Error: PII\n    ${frame}`;
  const sanitized = sanitizarErroParaSentry(error);
  expect(sanitized.stack).toContain(frame.replace('?token=segredo#privado', ''));
  expect(sanitized.stack).not.toMatch(/PII|segredo|privado/);
});
it('descarta console e desativa PII por padrão', () => {
  expect(sentryPrivacy.sendDefaultPii).toBe(false);
  expect(beforeBreadcrumb({ category: 'console', message: 'segredo' })).toBeNull();
});
it.each(['fetch', 'xhr', 'http', 'navigation'])('limpa URLs de breadcrumb %s', (category) => {
  const result = beforeBreadcrumb({ category, message: 'GET https://host/path?token=segredo#privado', data: { url: '/api?token=segredo', from: '/a#privado', to: 'https://host/b?token=segredo' } });
  expect(JSON.stringify(result)).not.toMatch(/segredo|privado|[?#]/);
  expect(result?.data?.url).toBe('/api');
});
it.each(['beforeSend', 'beforeSendTransaction'] as const)('%s remove request e identidade sensíveis e limpa spans', (hook) => {
  const event = {
    user: { id: 'segredo', email: 'segredo' },
    request: { url: 'https://host/p?token=segredo#privado', query_string: 'segredo', data: 'segredo', cookies: { session: 'segredo' }, headers: { Authorization: 'segredo', Cookie: 'segredo', 'X-Api-Key': 'segredo' } },
    transaction: 'GET /api/[id]?token=segredo#privado',
    spans: [{ description: 'GET https://host/path?token=segredo#privado', data: { 'url.full': 'https://host/path?token=segredo', 'http.query': 'segredo', 'http.target': '/path?token=segredo' } }],
  };
  const result = hook === 'beforeSend' ? sentryPrivacy.beforeSend({ ...event, type: undefined } as unknown as ErrorEvent) : sentryPrivacy.beforeSendTransaction(event as unknown as Event & { type: 'transaction' });
  expect(JSON.stringify(result)).not.toMatch(/segredo|privado/);
  expect(result).not.toHaveProperty('user');
  expect(result.request).toEqual({ url: 'https://host/p' });
  expect(result.transaction).toBe('GET /api/[id]');
});

it.each(['onerror', 'onunhandledrejection', 'auto.function.nextjs'])('sanitiza evento automático %s mantendo tipo e frames', (mechanism) => {
  const pii = 'ana@example.com +55 11 99999-1234 CPF 123.456.789-00 R$ 123,45 550e8400-e29b-41d4-a716-446655440000';
  const result = sentryPrivacy.beforeSend({
    message: pii,
    logentry: { message: pii, formatted: pii, params: [pii] },
    exception: { values: [{ type: 'TypeError', value: pii, mechanism: { type: mechanism, handled: false }, stacktrace: { frames: [{ filename: '/app/(dashboard)/page.tsx?email=ana@example.com#private', abs_path: 'https://host/app.js?cpf=123#private', lineno: 42, colno: 7 }] } }] },
    extra: { email: pii },
    breadcrumbs: [{ category: 'ui.click', message: pii, data: { target: pii } }],
    contexts: { os: { name: 'Linux', version: '6' }, browser: { name: 'Chrome', version: '130' }, runtime: { name: 'node', version: '22' }, react: { componentStack: '\n    at Page (/app/(dashboard)/page.tsx?email=ana@example.com:42:7)', props: { email: pii } }, profile: { email: pii }, custom: { value: pii } },
    tags: { page: 'https://host/path?email=ana@example.com', relative: '/path?cpf=123', module: 'financas' },
  } as unknown as ErrorEvent);
  expect(result.message).toBe('Falha na aplicação');
  expect(result.logentry).toEqual({ message: 'Falha na aplicação' });
  expect(result.exception?.values?.[0]).toMatchObject({ type: 'TypeError', value: 'Falha na aplicação', mechanism: { type: mechanism, handled: false }, stacktrace: { frames: [{ filename: '/app/(dashboard)/page.tsx', abs_path: 'https://host/app.js', lineno: 42, colno: 7 }] } });
  expect(result).not.toHaveProperty('extra');
  expect(result.breadcrumbs).toEqual([]);
  expect(Object.keys(result.contexts ?? {}).sort()).toEqual(['browser', 'os', 'react', 'runtime']);
  expect(result.contexts?.react).toEqual({ componentStack: '    at Page (/app/(dashboard)/page.tsx:42:7)' });
  expect(result.tags).toEqual({ module: 'financas' });
  expect(JSON.stringify(result)).not.toMatch(/ana@|99999|123\.456|123,45|550e8400|private|[?#]/);
});

it.each(['ui.click', 'ui.input'])('descarta breadcrumb %s com texto e seletor pessoais', (category) => {
  expect(beforeBreadcrumb({ category, message: 'button[aria-label="ana@example.com"]', data: { value: '123.456.789-00', target: '#ana@example.com' } })).toBeNull();
});

it('configura replay com mascaramento explícito de texto e mídia', async () => {
  const { readFileSync } = await import('node:fs');
  const config = readFileSync('apps/web/sentry.client.config.ts', 'utf8');
  expect(config).toMatch(/replayIntegration\(\{\s*maskAllText: true,\s*blockAllMedia: true,?\s*\}\)/);
});
