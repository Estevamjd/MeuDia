import type { PushPayload, PushSender } from '@meudia/api';

/** Compatível com web-push; fornecer a biblioteca quando a dependência for instalada. */
export interface WebPushAdapter {
  setVapidDetails(subject: string, publicKey: string, privateKey: string): void;
  sendNotification(subscription: { endpoint: string; keys: { p256dh: string; auth: string } }, payload: string): Promise<{ statusCode: number }>;
}
export function createPushSender(adapter?: WebPushAdapter): PushSender {
  const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT } = process.env;
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY || !VAPID_SUBJECT) throw new Error('Configuração VAPID incompleta');
  if (!adapter) throw new Error('Adapter web-push pendente de instalação');
  adapter.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
  return { send: (sub, payload: PushPayload) => adapter.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, JSON.stringify(payload)) };
}
