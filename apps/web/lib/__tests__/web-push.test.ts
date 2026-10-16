import { afterEach, expect, it, vi } from 'vitest';
import { createPushSender } from '../web-push';
afterEach(() => vi.unstubAllEnvs());
it('configuração ausente e adapter pendente falham explicitamente', () => {
  vi.stubEnv('VAPID_PUBLIC_KEY', '');
  expect(() => createPushSender()).toThrow('Configuração VAPID incompleta');
  vi.stubEnv('VAPID_PUBLIC_KEY', 'fixture-public'); vi.stubEnv('VAPID_PRIVATE_KEY', 'fixture-private'); vi.stubEnv('VAPID_SUBJECT', 'mailto:fixture@example.invalid');
  expect(() => createPushSender()).toThrow('Adapter web-push pendente');
});
it('adapter recebe VAPID e envia formato Web Push', async () => {
  vi.stubEnv('VAPID_PUBLIC_KEY', 'fixture-public'); vi.stubEnv('VAPID_PRIVATE_KEY', 'fixture-private'); vi.stubEnv('VAPID_SUBJECT', 'mailto:fixture@example.invalid');
  const adapter = { setVapidDetails: vi.fn(), sendNotification: vi.fn().mockResolvedValue({ statusCode: 201 }) };
  const payload = { title: 'Fixture', body: 'Fixture', url: '/financas', tag: 'fixture' };
  expect(await createPushSender(adapter).send({ endpoint: 'https://example.invalid', p256dh: 'fixture', auth: 'fixture' } as never, payload)).toEqual({ statusCode: 201 });
  expect(adapter.setVapidDetails).toHaveBeenCalledWith('mailto:fixture@example.invalid', 'fixture-public', 'fixture-private');
  expect(adapter.sendNotification).toHaveBeenCalledWith({ endpoint: 'https://example.invalid', keys: { p256dh: 'fixture', auth: 'fixture' } }, JSON.stringify(payload));
});
