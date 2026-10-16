import { afterEach, expect, it, vi } from 'vitest';
import webPush from 'web-push';
import { createPushSender } from '../web-push';
vi.mock('web-push', () => ({ default: { setVapidDetails: vi.fn(), sendNotification: vi.fn() } }));
afterEach(() => { vi.unstubAllEnvs(); vi.resetAllMocks(); });
it('configuração ausente falha explicitamente', () => {
  vi.stubEnv('VAPID_PUBLIC_KEY', '');
  expect(() => createPushSender()).toThrow('Configuração VAPID incompleta');

});
it('adapter recebe VAPID e envia formato Web Push', async () => {
  vi.stubEnv('VAPID_PUBLIC_KEY', 'fixture-public'); vi.stubEnv('VAPID_PRIVATE_KEY', 'fixture-private'); vi.stubEnv('VAPID_SUBJECT', 'mailto:fixture@example.invalid');
  const adapter = { setVapidDetails: vi.fn(), sendNotification: vi.fn().mockResolvedValue({ statusCode: 201 }) };
  const payload = { title: 'Fixture', body: 'Fixture', url: '/financas', tag: 'fixture' };
  expect(await createPushSender(adapter).send({ endpoint: 'https://example.invalid', p256dh: 'fixture', auth: 'fixture' } as never, payload)).toEqual({ statusCode: 201 });
  expect(adapter.setVapidDetails).toHaveBeenCalledWith('mailto:fixture@example.invalid', 'fixture-public', 'fixture-private');
  expect(adapter.sendNotification).toHaveBeenCalledWith({ endpoint: 'https://example.invalid', keys: { p256dh: 'fixture', auth: 'fixture' } }, JSON.stringify(payload));
});

it('usa a biblioteca real por padrão (mock sem rede)', async () => {
  vi.stubEnv('VAPID_PUBLIC_KEY', 'fixture-public'); vi.stubEnv('VAPID_PRIVATE_KEY', 'fixture-private'); vi.stubEnv('VAPID_SUBJECT', 'mailto:fixture@example.invalid');
  vi.mocked(webPush.sendNotification).mockResolvedValue({ statusCode: 201 } as never);
  const sender = createPushSender();
  expect(webPush.setVapidDetails).toHaveBeenCalledWith('mailto:fixture@example.invalid', 'fixture-public', 'fixture-private');
  const sub = { endpoint: 'https://example.invalid', p256dh: 'fixture', auth: 'fixture' };
  const payload = { title: 'Fixture', body: 'Fixture', url: '/financas', tag: 'fixture' };
  await expect(sender.send(sub as never, payload)).resolves.toMatchObject({ statusCode: 201 });
  expect(webPush.sendNotification).toHaveBeenCalledWith({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, JSON.stringify(payload));
});
it.each([404, 410])('propaga %s para remoção pelo serviço de lembretes', async statusCode => {
  vi.stubEnv('VAPID_PUBLIC_KEY', 'fixture-public'); vi.stubEnv('VAPID_PRIVATE_KEY', 'fixture-private'); vi.stubEnv('VAPID_SUBJECT', 'mailto:fixture@example.invalid');
  vi.mocked(webPush.sendNotification).mockRejectedValue({ statusCode });
  await expect(createPushSender().send({ endpoint: 'https://example.invalid', p256dh: 'fixture', auth: 'fixture' } as never, { title: '', body: '', url: '/financas', tag: '' })).rejects.toEqual({ statusCode });
});
