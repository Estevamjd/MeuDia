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
const vinculado = { ok: true, vinculado: true, etapa: 'concluido', tentativas: 0, nome: 'Estevam Juliano', metas: [], estilo_tamanho: 'curto', estilo_emoji: true, msgs_hoje: 1, limite_excedido: false };

describe('processarEvento', () => {
  const registrar = vi.fn();
  const enviar = vi.fn();
  const interpretarIA = vi.fn();
  const extrairIA = vi.fn();
  const conversarIA = vi.fn();
  const contato = vi.fn();
  const onboarding = vi.fn();
  const deps = () => ({ registrar, enviar, interpretarIA, extrairIA, conversarIA, contato, onboarding, agora });

  beforeEach(() => {
    vi.stubEnv('WHATSAPP_NUMEROS_PERMITIDOS', '5511988887777');
    vi.stubEnv('WHATSAPP_ONBOARDING_ABERTO', '');
    vi.stubEnv('WHATSAPP_LIMITE_DIA', '');
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://app.teste');
    registrar.mockReset().mockResolvedValue({ ok: true, nome: 'Estevam Juliano', extras: {} });
    enviar.mockReset().mockResolvedValue(true);
    interpretarIA.mockReset().mockResolvedValue(null);
    extrairIA.mockReset().mockResolvedValue(null);
    conversarIA.mockReset().mockResolvedValue(null);
    contato.mockReset().mockResolvedValue(vinculado);
    onboarding.mockReset().mockResolvedValue({ ok: true });
  });
  afterEach(() => vi.unstubAllEnvs());

  it('conta ligada: gasto grava (RPC) e confirma com a dica proativa', async () => {
    registrar.mockResolvedValue({ ok: true, nome: 'Estevam Juliano', extras: { categoria: 'Mercado', planejado: 500, gasto_mes: 45.9 } });
    const r = await processarEvento(msg('gastei 45,90 no mercado'), deps());
    expect(contato).toHaveBeenCalledWith('5511988887777', 30);
    expect(registrar).toHaveBeenCalledWith('5511988887777', 'false_5511988887777@c.us_ABC', { tipo: 'gasto', valor: 45.9, descricao: 'Mercado', categoria: 'Mercado' });
    expect(r).toMatchObject({ status: 'respondido', intencao: 'gasto' });
    expect(String(enviar.mock.calls[0]![1]).replace(/\u00a0/g, ' ')).toMatch(/^✅ Anotado, Estevam: gasto de R\$.*\nAinda tem R\$ 454,10 do orçamento de Mercado/);
    expect(interpretarIA).not.toHaveBeenCalled();
    expect(onboarding).not.toHaveBeenCalled();
  });

  it('treino e refeição', async () => {
    await processarEvento(msg('treinei peito 40min'), deps());
    expect(registrar.mock.calls[0]![2]).toEqual({ tipo: 'treino', descricao: 'Peito', duracao_min: 40 });
    await processarEvento(msg('almocei arroz, feijão, frango'), deps());
    expect(registrar.mock.calls[1]![2]).toEqual({ tipo: 'refeicao', refeicao: 'almoco', descricao: 'Arroz, feijão, frango' });
  });

  it('portão fechado (lista vazia e onboarding fechado): ninguém passa, nada é consultado', async () => {
    vi.stubEnv('WHATSAPP_NUMEROS_PERMITIDOS', '');
    expect(await processarEvento(msg('oi'), deps())).toEqual({ status: 'ignorado', motivo: 'fora_da_lista' });
    expect(contato).not.toHaveBeenCalled();
    expect(enviar).not.toHaveBeenCalled();
  });

  it('WHATSAPP_ONBOARDING_ABERTO=true deixa número novo entrar no onboarding', async () => {
    vi.stubEnv('WHATSAPP_NUMEROS_PERMITIDOS', '');
    vi.stubEnv('WHATSAPP_ONBOARDING_ABERTO', 'true');
    contato.mockResolvedValue({ ...vinculado, vinculado: false, etapa: 'inicio', nome: null });
    const r = await processarEvento(msg('oi'), deps());
    expect(onboarding).toHaveBeenCalledWith('5511988887777', { etapa: 'nome', tentativas: 0 }, false);
    expect(r).toMatchObject({ status: 'respondido', intencao: 'onboarding' });
    expect(enviar.mock.calls[0]![1]).toMatch(/^Oi, tudo bem\? 😊 Eu sou o MeuDia/);
  });

  it('fim do onboarding: troca {LINK} pelo link de uso único', async () => {
    contato.mockResolvedValue({ ...vinculado, vinculado: false, etapa: 'estilo', nome: 'Lia' });
    onboarding.mockResolvedValue({ ok: true, token: 'a'.repeat(64) });
    await processarEvento(msg('curtas'), deps());
    expect(onboarding).toHaveBeenCalledWith('5511988887777', { estilo_tamanho: 'curto', etapa: 'link', tentativas: 0 }, true);
    expect(enviar.mock.calls[0]![1]).toContain(`https://app.teste/whatsapp?t=${'a'.repeat(64)}`);
    expect(enviar.mock.calls[0]![1]).not.toContain('{LINK}');
  });

  it('limite diário: avisa uma vez e depois fica quieto', async () => {
    vi.stubEnv('WHATSAPP_LIMITE_DIA', '3');
    contato.mockResolvedValue({ ...vinculado, msgs_hoje: 4, limite_excedido: true });
    expect(await processarEvento(msg('gastei 10'), deps())).toMatchObject({ status: 'respondido', intencao: 'limite' });
    expect(contato).toHaveBeenCalledWith('5511988887777', 3);
    contato.mockResolvedValue({ ...vinculado, msgs_hoje: 5, limite_excedido: true });
    expect(await processarEvento(msg('gastei 10'), deps())).toEqual({ status: 'ignorado', motivo: 'limite' });
    expect(enviar).toHaveBeenCalledTimes(1);
    expect(registrar).not.toHaveBeenCalled();
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

  it('duplicada (reentrega do WAHA): não responde', async () => {
    registrar.mockResolvedValue({ ok: true, duplicada: true });
    expect(await processarEvento(msg('gastei 10'), deps())).toEqual({ status: 'ignorado', motivo: 'duplicada' });
    expect(enviar).not.toHaveBeenCalled();
  });

  it('não é registro: IA interpreta; se não, a persona conversa; sem IA, ajuda curta', async () => {
    await processarEvento(msg('hoje foi puxado'), deps());
    expect(interpretarIA).toHaveBeenCalledWith('hoje foi puxado', '2026-11-19');
    expect(conversarIA).toHaveBeenCalled();
    expect(enviar.mock.calls[0]![1]).toMatch(/Não entendi/);
    conversarIA.mockResolvedValue('Dia puxado pede descanso 😊 Quer anotar o treino de hoje? Ex.: "treinei pernas 40min"');
    const r = await processarEvento(msg('hoje foi puxado'), deps());
    expect(r).toMatchObject({ intencao: 'conversa' });
  });

  it('usa a interpretação da IA quando ela entende', async () => {
    interpretarIA.mockResolvedValue({ tipo: 'gasto', valor: 320, descricao: 'Fatura do Nubank', categoria: 'Contas', data: '2026-11-12' });
    await processarEvento(msg('passei o cartão da fatura do nubank, trezentos e vinte'), deps());
    expect(registrar.mock.calls[0]![2]).toMatchObject({ tipo: 'gasto', valor: 320 });
  });

  it('falha do banco ao buscar contato vira resposta amigável', async () => {
    contato.mockResolvedValue({ ok: false, erro: 'rede' });
    await processarEvento(msg('gastei 10'), deps());
    expect(enviar.mock.calls[0]![1]).toMatch(/Não consegui anotar agora/);
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
