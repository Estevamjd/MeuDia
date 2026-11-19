import { createHmac } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
const processarEvento = vi.fn(async () => ({ status: 'ignorado', motivo: 'fora_da_lista' }));
vi.mock('../../../../../lib/whatsapp/processar', async (orig) => ({
  ...(await orig<Record<string, unknown>>()),
  processarEvento,
}));
const { POST } = await import('../route');

const pedido = (corpo: string, assinatura?: string) =>
  new Request('http://x/api/whatsapp/webhook', {
    method: 'POST',
    body: corpo,
    headers: assinatura ? { 'x-webhook-hmac': assinatura, 'x-webhook-hmac-algorithm': 'sha512' } : {},
  }) as never;

afterEach(() => {
  vi.unstubAllEnvs();
  processarEvento.mockClear();
});

describe('POST /api/whatsapp/webhook', () => {
  const corpo = JSON.stringify({ event: 'message', payload: { from: '5511988887777@c.us', body: 'oi' } });

  it('sem chave configurada: desligado (503)', async () => {
    vi.stubEnv('WHATSAPP_WEBHOOK_HMAC_KEY', '');
    expect((await POST(pedido(corpo))).status).toBe(503);
  });

  it('sem assinatura ou assinatura errada: 401 e nada é processado', async () => {
    vi.stubEnv('WHATSAPP_WEBHOOK_HMAC_KEY', 'chave-teste');
    expect((await POST(pedido(corpo))).status).toBe(401);
    expect((await POST(pedido(corpo, 'f'.repeat(128)))).status).toBe(401);
    expect(processarEvento).not.toHaveBeenCalled();
  });

  it('assinado: processa', async () => {
    vi.stubEnv('WHATSAPP_WEBHOOK_HMAC_KEY', 'chave-teste');
    const res = await POST(pedido(corpo, createHmac('sha512', 'chave-teste').update(corpo).digest('hex')));
    expect(res.status).toBe(200);
    expect(processarEvento).toHaveBeenCalledWith(JSON.parse(corpo));
  });
});
