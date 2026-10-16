import type * as ApiModule from '@meudia/api';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { AppError } from '@meudia/shared';
import { GET } from '../cron/lembretes/route';
import { POST, DELETE, GET as consultarPush } from '../push/subscribe/route';
import { POST as pagar } from '../financas/contas/[id]/pagar/route';
import { createServerSupabaseClient } from '../../../lib/supabase/server';
import { createPushSender } from '../../../lib/web-push';
import { createClient } from '@supabase/supabase-js';
import { lembretesService, pushSubscriptionsRepository as push, contasPagarService as contas } from '@meudia/api';
import type * as Api from '@meudia/api';
vi.mock('../../../lib/supabase/server', () => ({ createServerSupabaseClient: vi.fn() }));
vi.mock('../../../lib/web-push', () => ({ createPushSender: vi.fn() }));
vi.mock('@supabase/supabase-js', () => ({ createClient: vi.fn() }));
vi.mock('@meudia/api', async importOriginal => {
  const original = await importOriginal<typeof ApiModule>();
  return { ...original,
    lembretesService: { enviarLembretesDoDia: vi.fn() },
    pushSubscriptionsRepository: { upsertByEndpoint: vi.fn(), removeByEndpoint: vi.fn() },
    contasPagarService: { pagarConta: vi.fn() },
  };
});
const getUser = vi.fn();
const maybeSingle = vi.fn();
const eq = vi.fn();
const from = vi.fn();
const client = { auth: { getUser }, from };
const req = (body: unknown) => new Request('https://example.invalid', { method: 'POST', body: JSON.stringify(body) });
beforeEach(() => {
  vi.resetAllMocks();
  from.mockReturnValue({ select: () => ({ eq }) });
  eq.mockReturnValue({ eq, maybeSingle });
  vi.stubEnv('CRON_SECRET', 'fixture-cron');
  vi.mocked(createServerSupabaseClient).mockReturnValue(client as never);
  getUser.mockResolvedValue({ data: { user: { id: 'u' } }, error: null });
});
afterEach(() => vi.unstubAllEnvs());
it('cron 401 sem header, incorreto e sem secret', async () => {
  expect((await GET(new Request('https://example.invalid'))).status).toBe(401);
  expect((await GET(new Request('https://example.invalid', { headers: { Authorization: 'Bearer errado' } }))).status).toBe(401);
  for (const token of ['Bearer fixture-croo', 'Bearer fixture-cron-extra', 'fixture-cron']) {
    expect((await GET(new Request('https://example.invalid', { headers: { Authorization: token } }))).status).toBe(401);
  }
  vi.stubEnv('CRON_SECRET', undefined);
  expect((await GET(new Request('https://example.invalid', { headers: { Authorization: 'Bearer fixture-cron' } }))).status).toBe(401);
  vi.stubEnv('CRON_SECRET', '');
  expect((await GET(new Request('https://example.invalid', { headers: { Authorization: 'Bearer ' } }))).status).toBe(401);
  expect(createClient).not.toHaveBeenCalled(); expect(lembretesService.enviarLembretesDoDia).not.toHaveBeenCalled();
});
it('cron autorizado usa admin e responde só contadores', async () => {
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://example.invalid'); vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'fixture-service');
  vi.mocked(createClient).mockReturnValue(client as never);
  const sender = { send: vi.fn() }; vi.mocked(createPushSender).mockReturnValue(sender);
  const contadores = { contas: 1, enviados: 1, ignorados: 0, inscricoesRemovidas: 0 };
  vi.mocked(lembretesService.enviarLembretesDoDia).mockResolvedValue(contadores);
  const response = await GET(new Request('https://example.invalid', { headers: { Authorization: 'Bearer fixture-cron' } }));
  expect(response.status).toBe(200); expect(await response.json()).toEqual(contadores);
  expect(lembretesService.enviarLembretesDoDia).toHaveBeenCalledWith({ client, sender });
});
it('push e pagar exigem sessão', async () => {
  getUser.mockResolvedValue({ data: { user: null }, error: null });
  expect((await POST(req({}))).status).toBe(401); expect((await DELETE(req({}))).status).toBe(401);
  expect((await pagar(req({}), { params: { id: 'c' } })).status).toBe(401);
});
it('push valida e vincula ao usuário autenticado com client isolado', async () => {
  const sub = { endpoint: 'https://example.invalid', keys: { auth: 'fixture', p256dh: 'fixture' }, user_agent: 'Fixture' };
  expect((await POST(req({ ...sub, user_id: 'outro' }))).status).toBe(200);
  expect(push.upsertByEndpoint).toHaveBeenCalledWith('u', sub, client);
  expect((await POST(req({ ...sub, user_agent: 'x'.repeat(501) }))).status).toBe(400);
  expect((await DELETE(req({ endpoint: sub.endpoint }))).status).toBe(200);
  expect(push.removeByEndpoint).toHaveBeenCalledWith('u', sub.endpoint, client);
  vi.mocked(push.upsertByEndpoint).mockRejectedValue(new AppError('Inscrição duplicada', 'CONFLICT', 409));
  expect((await POST(req(sub))).status).toBe(409);
});
it('Paguei encaminha competência e retorna conflito de domínio/404', async () => {
  vi.mocked(contas.pagarConta).mockResolvedValue({ competencia: '2026-10' } as never);
  const input = { competencia: '2026-10' };
  expect((await pagar(req(input), { params: { id: 'c' } })).status).toBe(200);
  expect(contas.pagarConta).toHaveBeenCalledWith('u', 'c', input, client);
  vi.mocked(contas.pagarConta).mockRejectedValue(new AppError('Competência já paga', 'COMPETENCIA_JA_PAGA', 409));
  const response = await pagar(req(input), { params: { id: 'c' } });
  expect(response.status).toBe(409); expect(await response.json()).toMatchObject({ code: 'COMPETENCIA_JA_PAGA' });
  vi.mocked(contas.pagarConta).mockRejectedValue(new AppError('Conta não encontrada', 'NOT_FOUND', 404));
  expect((await pagar(req(input), { params: { id: 'c' } })).status).toBe(404);
});
it('cron falha sem reservar quando adapter não está disponível', async () => {
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://example.invalid'); vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'fixture-service');
  vi.mocked(createPushSender).mockImplementation(() => { throw new Error('Adapter pendente'); });
  const response = await GET(new Request('https://example.invalid', { headers: { Authorization: 'Bearer fixture-cron' } }));
  expect(response.status).toBe(500);
  expect(createClient).not.toHaveBeenCalled(); expect(lembretesService.enviarLembretesDoDia).not.toHaveBeenCalled();
});

it('consulta push filtra usuário autenticado e endpoint', async () => {
  const request = new Request('https://example.invalid/api/push/subscribe?endpoint=https%3A%2F%2Fexample.invalid%2Fpush');
  for (const data of [null, { id: 'inscricao' }]) {
    maybeSingle.mockResolvedValue({ data, error: null });
    const response = await consultarPush(request);
    expect(await response.json()).toEqual({ inscrito: !!data, userId: 'u' });
    expect(eq).toHaveBeenCalledWith('user_id', 'u');
    expect(eq).toHaveBeenCalledWith('endpoint', 'https://example.invalid/push');
  }
  getUser.mockResolvedValue({ data: { user: null }, error: null });
  expect((await consultarPush(request)).status).toBe(401);
});
