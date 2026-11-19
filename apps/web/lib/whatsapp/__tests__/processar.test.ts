import { createHmac } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
const { assinaturaValida, processarEvento } = await import('../processar');

const msg = (body: string, extra: Record<string, unknown> = {}) => ({
  event: 'message',
  session: 'default',
  payload: { id: 'false_5511988887777@c.us_ABC', from: '5511988887777@c.us', fromMe: false, body, hasMedia: false, ...extra },
});
const agora = new Date('2026-11-19T15:00:00Z'); // 12h em SP

describe('processarEvento', () => {
  const registrar = vi.fn();
  const enviar = vi.fn();
  const interpretarIA = vi.fn();
  const deps = () => ({ registrar, enviar, interpretarIA, agora });

  beforeEach(() => {
    vi.stubEnv('WHATSAPP_NUMEROS_PERMITIDOS', '5511988887777');
    registrar.mockReset().mockResolvedValue({ ok: true, nome: 'Estevam Juliano' });
    enviar.mockReset().mockResolvedValue(true);
    interpretarIA.mockReset().mockResolvedValue(null);
  });
  afterEach(() => vi.unstubAllEnvs());

  it('gasto: grava com origem WhatsApp (RPC) e confirma curto', async () => {
    const r = await processarEvento(msg('gastei 45,90 no mercado'), deps());
    expect(registrar).toHaveBeenCalledWith('5511988887777', 'false_5511988887777@c.us_ABC', { tipo: 'gasto', valor: 45.9, descricao: 'Mercado', categoria: 'Mercado' });
    expect(enviar).toHaveBeenCalledWith('5511988887777@c.us', expect.stringContaining('gasto de R$'));
    expect(r).toMatchObject({ status: 'respondido', intencao: 'gasto' });
    expect(enviar.mock.calls[0]![1]).toContain('Estevam');
    expect(interpretarIA).not.toHaveBeenCalled();
  });

  it('treino e refeição', async () => {
    await processarEvento(msg('treinei peito 40min'), deps());
    expect(registrar.mock.calls[0]![2]).toEqual({ tipo: 'treino', descricao: 'Peito', duracao_min: 40 });
    await processarEvento(msg('almocei arroz, feijão, frango'), deps());
    expect(registrar.mock.calls[1]![2]).toEqual({ tipo: 'refeicao', refeicao: 'almoco', descricao: 'Arroz, feijão, frango' });
  });

  it('lista vazia: ninguém escreve e o bot não responde', async () => {
    vi.stubEnv('WHATSAPP_NUMEROS_PERMITIDOS', '');
    expect(await processarEvento(msg('gastei 10'), deps())).toEqual({ status: 'ignorado', motivo: 'fora_da_lista' });
    expect(registrar).not.toHaveBeenCalled();
    expect(enviar).not.toHaveBeenCalled();
  });

  it.each([
    ['mensagem própria', msg('gastei 10', { fromMe: true }), 'proprio'],
    ['grupo', msg('gastei 10', { from: '1203@g.us' }), 'grupo'],
    ['status', msg('gastei 10', { from: 'status@broadcast' }), 'grupo'],
    ['mídia sem texto', msg('', { hasMedia: true }), 'sem_texto'],
    ['outro evento', { event: 'session.status', payload: {} }, 'evento'],
  ])('ignora %s sem responder', async (_n, evento, motivo) => {
    expect(await processarEvento(evento, deps())).toEqual({ status: 'ignorado', motivo });
    expect(enviar).not.toHaveBeenCalled();
  });

  it('duplicada (reentrega do WAHA): não grava de novo nem responde', async () => {
    registrar.mockResolvedValue({ ok: true, duplicada: true });
    expect(await processarEvento(msg('gastei 10'), deps())).toEqual({ status: 'ignorado', motivo: 'duplicada' });
    expect(enviar).not.toHaveBeenCalled();
  });

  it('regras não entendem → IA; IA sem chave/sem resposta → mensagem de ajuda curta', async () => {
    await processarEvento(msg('hoje foi puxado'), deps());
    expect(interpretarIA).toHaveBeenCalledWith('hoje foi puxado', '2026-11-19');
    expect(registrar).not.toHaveBeenCalled();
    expect(enviar.mock.calls[0]![1]).toMatch(/Não entendi/);
  });

  it('usa a interpretação da IA quando ela entende', async () => {
    interpretarIA.mockResolvedValue({ tipo: 'gasto', valor: 18, descricao: 'pão', categoria: 'Comida' });
    await processarEvento(msg('passei na padoca, 18 conto de pão'.replace(/\d+/, 'dezoito')), deps());
    expect(registrar.mock.calls[0]![2]).toMatchObject({ tipo: 'gasto', valor: 18 });
  });

  it('erro do banco vira resposta amigável', async () => {
    registrar.mockResolvedValue({ ok: false, erro: 'numero_sem_conta' });
    await processarEvento(msg('gastei 10'), deps());
    expect(enviar.mock.calls[0]![1]).toMatch(/Configurações → Seu WhatsApp/);
  });
});

describe('assinaturaValida', () => {
  const corpo = '{"event":"message"}';
  const hmac = createHmac('sha512', 'k').update(corpo).digest('hex');
  it('aceita HMAC-SHA512 correto e recusa o resto', () => {
    expect(assinaturaValida(corpo, hmac, 'k')).toBe(true);
    expect(assinaturaValida(corpo, hmac.toUpperCase(), 'k')).toBe(true);
    expect(assinaturaValida(corpo + ' ', hmac, 'k')).toBe(false);
    expect(assinaturaValida(corpo, hmac, 'outra')).toBe(false);
    expect(assinaturaValida(corpo, null, 'k')).toBe(false);
    expect(assinaturaValida(corpo, 'abc', 'k')).toBe(false);
  });
});
