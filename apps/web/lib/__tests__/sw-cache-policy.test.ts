import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { expect, it, vi } from 'vitest';

const origin = 'https://example.invalid';
const source = readFileSync(new URL('../../public/sw.js', import.meta.url), 'utf8');
function worker() {
  const listeners: Record<string, (event: unknown) => void> = {};
  const cache = { match: vi.fn(), put: vi.fn().mockResolvedValue(undefined) };
  const caches = { open: vi.fn().mockResolvedValue(cache), keys: vi.fn().mockResolvedValue(['meudia-v7', 'meudia-v8']), delete: vi.fn().mockResolvedValue(true) };
  const fetch = vi.fn().mockResolvedValue(new Response('asset', { headers: { 'content-type': 'image/png' } }));
  const self = { location: { origin }, addEventListener: (name: string, listener: (event: unknown) => void) => { listeners[name] = listener; }, clients: { claim: vi.fn() }, skipWaiting: vi.fn() };
  const policy = runInNewContext(`${source}\nshouldCache`, { URL, Request, self, caches, fetch }) as (request: Request, origin: string, response?: Response) => boolean;
  return { policy, listeners, cache, caches, fetch, self };
}
const request = (path: string, init: RequestInit = {}) => new Request(origin + path, { credentials: 'omit', ...init });
const response = (type = 'image/png', headers = {}) => new Response('asset', { headers: { 'content-type': type, ...headers } });

it.each([
  ['/_next/static/chunks/app.js', 'application/javascript'],
  ['/_next/static/css/app.css', 'text/css'],
  ['/icons/icon-192.png', 'image/png'], ['/fonts/app.woff2', 'font/woff2'],
  ['/images/logo.svg', 'image/svg+xml'], ['/favicon.png', 'image/png'],
])('permite só asset público anônimo %s', (path, type) => {
  expect(worker().policy(request(path), origin, response(type))).toBe(true);
});
it.each(['/', '/login', '/financas', '/financas/contas', '/api', '/api/contas', '/api/logo.png', '/_next/data/build/financas.json', '/images/contas.json', '/treinos'])('network-only para %s', path => {
  expect(worker().policy(request(path), origin, response())).toBe(false);
});
it.each([
  ['/manifest.json', 'application/json'], ['/manifest.webmanifest', 'application/manifest+json'],
])('manifest %s é network-only (muda por APP_MODE) e nunca é servido do cache', async (path, type) => {
  const { policy, listeners, caches, cache } = worker();
  expect(policy(request(path), origin)).toBe(false);
  expect(policy(request(path), origin, response(type))).toBe(false);
  cache.match.mockResolvedValue(response(type));
  const respondWith = vi.fn();
  listeners.fetch!({ request: request(path), respondWith });
  expect(respondWith).not.toHaveBeenCalled();
  expect(caches.open).not.toHaveBeenCalled();
});
it('rejeita credenciais, navegação, origem externa e métodos de escrita', () => {
  const { policy } = worker();
  for (const credentials of ['include', 'same-origin'] as const) expect(policy(request('/icons/icon-192.png', { credentials }), origin)).toBe(false);
  for (const name of ['Authorization', 'Cookie']) expect(policy(request('/icons/icon-192.png', { headers: { [name]: 'fixture' } }), origin)).toBe(false);
  expect(policy(request('/icons/icon-192.png', { method: 'POST' }), origin)).toBe(false);
  expect(policy(new Request('https://external.invalid/icons/icon.png', { credentials: 'omit' }), origin)).toBe(false);
  const req = request('/icons/icon-192.png');
  Object.defineProperty(req, 'mode', { value: 'navigate' });
  expect(policy(req, origin)).toBe(false);
});
it('rejeita HTML, dados, respostas privadas, erros e redirects disfarçados de assets', () => {
  const { policy } = worker();
  const req = request('/_next/static/app.js');
  for (const type of ['text/html', 'application/xhtml+xml', 'application/json', 'text/x-component', '']) expect(policy(req, origin, response(type))).toBe(false);
  for (const headers of [{ 'set-cookie': 'fixture' }, { authorization: 'fixture' }, { 'cache-control': 'private' }, { 'cache-control': 'no-store' }, { 'cache-control': 'no-cache' }, { vary: 'Cookie' }, { vary: 'Authorization' }, { vary: '*' }]) expect(policy(req, origin, response('image/png', headers))).toBe(false);
  expect(policy(req, origin, new Response('', { status: 404 }))).toBe(false);
  const redirected = response();
  Object.defineProperty(redirected, 'redirected', { value: true });
  expect(policy(req, origin, redirected)).toBe(false);
});
it('não intercepta páginas/APIs nem tenta fallback offline para dados financeiros', () => {
  const { listeners, caches, fetch } = worker();
  const respondWith = vi.fn();
  for (const path of ['/financas', '/api/contas', '/login']) listeners.fetch!({ request: request(path), respondWith });
  expect(respondWith).not.toHaveBeenCalled();
  expect(caches.open).not.toHaveBeenCalled();
  expect(fetch).not.toHaveBeenCalled();
});
it('grava somente resposta de asset permitida; HTML nunca entra no cache', async () => {
  const { listeners, cache, fetch } = worker();
  const waits: Promise<unknown>[] = [];
  let result: Promise<Response> | undefined;
  const event = { request: request('/icons/icon-192.png'), respondWith: (value: Promise<Response>) => { result = value; }, waitUntil: (value: Promise<unknown>) => waits.push(value) };
  listeners.fetch!(event);
  await result; await Promise.all(waits);
  expect(cache.put).toHaveBeenCalledTimes(1);
  cache.put.mockClear();
  fetch.mockResolvedValue(response('text/html'));
  listeners.fetch!(event); await result;
  expect(cache.put).not.toHaveBeenCalled();
});
it('activate remove cache antigo contendo HTML e preserva apenas v8; mantém push e clique', async () => {
  const { listeners, caches } = worker();
  let done: Promise<unknown> | undefined;
  listeners.activate!({ waitUntil: (value: Promise<unknown>) => { done = value; } });
  await done;
  expect(caches.delete).toHaveBeenCalledTimes(1);
  expect(caches.delete).toHaveBeenCalledWith('meudia-v7');
  expect(listeners.push).toBeTypeOf('function');
  expect(listeners.notificationclick).toBeTypeOf('function');
});

it('install só busca ícones sem cookies e permite atualização mesmo se um ícone falhar', async () => {
  const { listeners, fetch, self, cache } = worker();
  fetch.mockRejectedValueOnce(new Error('offline'));
  let done: Promise<unknown> | undefined;
  listeners.install!({ waitUntil: (value: Promise<unknown>) => { done = value; } });
  await done;
  expect(fetch).toHaveBeenCalledTimes(4);
  for (const [req] of fetch.mock.calls as unknown as [Request][]) {
    expect(req.credentials).toBe('omit');
    expect(new URL(req.url).pathname).toMatch(/\.png$/);
  }
  expect(cache.put).toHaveBeenCalledTimes(3);
  expect(self.skipWaiting).toHaveBeenCalledTimes(1);
});
