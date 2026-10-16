/** Helpers puros de Web Push no cliente (SPEC 6). */

export type EstadoPush =
  | 'carregando'
  | 'requer-instalacao'
  | 'nao-suportado'
  | 'nao-configurado'
  | 'negado'
  | 'ativo'
  | 'inativo';

export interface AmbientePush {
  suportado: boolean;
  configurado: boolean;
  ios: boolean;
  standalone: boolean;
  permissao: NotificationPermission;
  inscrito: boolean;
}

export function calcularEstadoPush(a: AmbientePush): EstadoPush {
  // iOS só expõe push com o PWA instalado (16.4+): orientar a instalação antes de "não suportado".
  if (a.ios && !a.standalone) return 'requer-instalacao';
  if (!a.suportado) return 'nao-suportado';
  if (!a.configurado) return 'nao-configurado';
  if (a.permissao === 'denied') return 'negado';
  return a.inscrito && a.permissao === 'granted' ? 'ativo' : 'inativo';
}

export function isIOS(userAgent: string, maxTouchPoints = 0): boolean {
  // iPadOS 13+ se identifica como Mac; diferencia pelo toque.
  return /iPad|iPhone|iPod/.test(userAgent) || (/Macintosh/.test(userAgent) && maxTouchPoints > 1);
}

/** `applicationServerKey` a partir da chave VAPID pública em base64url. */
// Sem anotação de retorno: no TS 5.7+ preserva `Uint8Array<ArrayBuffer>` (exigido por BufferSource).
export function urlBase64ToUint8Array(base64: string) {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const normal = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(normal);
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

export interface PushSubscriptionPayload {
  endpoint: string;
  keys: { p256dh: string; auth: string };
  user_agent?: string;
}

/** Corpo de `POST /api/push/subscribe` a partir de `PushSubscription.toJSON()`. */
export function payloadInscricao(
  json: { endpoint?: string; keys?: Record<string, string> },
  userAgent?: string,
): PushSubscriptionPayload {
  const { endpoint, keys } = json;
  if (!endpoint || !keys?.p256dh || !keys?.auth) throw new Error('Inscrição de push incompleta');
  return {
    endpoint,
    keys: { p256dh: keys.p256dh, auth: keys.auth },
    ...(userAgent ? { user_agent: userAgent.slice(0, 500) } : {}),
  };
}
