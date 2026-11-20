import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
const { desfazerUltimo, executarManutencaoDiaria, registrarNoBanco } = await import('../servicos');

describe('RPCs WhatsApp v2', () => {
  beforeEach(() => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'http://127.0.0.1:54329');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'anon-sintetica');
    vi.stubEnv('WHATSAPP_RPC_SEGREDO', 'segredo-sintetico');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', '');
  });
  afterEach(() => vi.unstubAllEnvs());

  it('desfazer envia identidade da mensagem e autentica só com anon + segredo', async () => {
    const f = vi.fn(async (_url: string | URL | Request, _init?: RequestInit) => new Response(JSON.stringify({ ok: true, desfeito: true, descricao: 'Mercado', valor: 45.9 })));
    expect(await desfazerUltimo('5511988887777', 'msg-undo', f)).toMatchObject({ desfeito: true });
    const [url, init] = f.mock.calls[0]!;
    expect(url).toBe('http://127.0.0.1:54329/rest/v1/rpc/whatsapp_desfazer');
    expect(JSON.parse(String(init?.body))).toEqual({ p_segredo: 'segredo-sintetico', p_telefone: '5511988887777', p_mensagem_id: 'msg-undo' });
    expect(init?.headers).toMatchObject({ apikey: 'anon-sintetica', authorization: 'Bearer anon-sintetica' });
  });

  it('registrar preserva a indicação explícita de pagamento', async () => {
    const f = vi.fn(async (_url: string | URL | Request, _init?: RequestInit) => new Response(JSON.stringify({ ok: true })));
    await registrarNoBanco('5511988887777', 'msg-gasto', { tipo: 'gasto', descricao: 'Luz', categoria: 'Luz', valor: 120, pagar: true }, f);
    expect(JSON.parse(String(f.mock.calls[0]![1]?.body)).p_dados).toMatchObject({ pagar: true, valor: 120 });
    await registrarNoBanco('5511988887777', 'msg-conta', { tipo: 'gasto', descricao: 'Luz', categoria: 'Luz', valor: null, pagar: true }, f);
    expect(JSON.parse(String(f.mock.calls[1]![1]?.body)).p_dados).toMatchObject({ pagar: true, valor: null });
  });

  it('manutenção sem configuração e erro de rede degradam sem lançar exceção', async () => {
    const f = vi.fn(async () => { throw new Error('rede'); });
    expect(await executarManutencaoDiaria(f)).toEqual({ ok: false, erro: 'rede' });
    vi.stubEnv('WHATSAPP_RPC_SEGREDO', '');
    expect(await executarManutencaoDiaria(f)).toEqual({ ok: false, erro: 'nao_configurado' });
    expect(f).toHaveBeenCalledTimes(1);
  });
});
