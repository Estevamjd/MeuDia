import { afterEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('server-only', () => ({}));
const rodar = vi.fn(async () => ({ ok: true, sessao: 'DRY_RUN', planejados: 0, enviados: 0, itens: [] }));
vi.mock('../../../../../lib/whatsapp/lembretes-rodada', () => ({ rodarLembretes: rodar }));
const { POST } = await import('../route');

const SEGREDO = 'x'.repeat(40);
const req = (q = '', auth?: string) => new NextRequest(`http://localhost/api/whatsapp/lembretes${q}`, { method: 'POST', headers: auth ? { authorization: auth } : {} });

describe('POST /api/whatsapp/lembretes', () => {
  afterEach(() => { vi.unstubAllEnvs(); rodar.mockClear(); });

  it('sem segredo configurado: desligada (503)', async () => {
    vi.stubEnv('WHATSAPP_LEMBRETES_SEGREDO', '');
    expect((await POST(req('', `Bearer ${SEGREDO}`))).status).toBe(503);
  });
  it('segredo errado ou ausente: 401 e não roda', async () => {
    vi.stubEnv('WHATSAPP_LEMBRETES_SEGREDO', SEGREDO);
    expect((await POST(req())).status).toBe(401);
    expect((await POST(req('', 'Bearer errado'))).status).toBe(401);
    expect(rodar).not.toHaveBeenCalled();
  });
  it('dry-run com horário simulado e IA opcional', async () => {
    vi.stubEnv('WHATSAPP_LEMBRETES_SEGREDO', SEGREDO);
    const r = await POST(req('?dry=1&agora=2026-11-23T19:00:00-03:00&ia=1', `Bearer ${SEGREDO}`));
    expect(r.status).toBe(200);
    expect(rodar).toHaveBeenCalledWith({ dry: true, agora: new Date('2026-11-23T22:00:00Z'), usarIA: true });
  });
  it('rodada real ignora "agora" e "ia"', async () => {
    vi.stubEnv('WHATSAPP_LEMBRETES_SEGREDO', SEGREDO);
    await POST(req('?agora=2026-11-23T19:00:00-03:00&ia=1', `Bearer ${SEGREDO}`));
    expect(rodar).toHaveBeenCalledWith({ dry: false, agora: undefined, usarIA: false });
  });
});
