import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Contato } from '../contato';
import { ganchoDaMeta } from '../ganchos';
import { interpretarPorRegras } from '../regras';

vi.mock('server-only', () => ({}));
const { comentarComHumor, comentarioPronto, contextoDoComentario, personaSystem } = await import('../persona');
const { processarEvento } = await import('../processar');

const contato = (c: Partial<Contato> = {}): Contato => ({
  vinculado: true, etapa: 'concluido', tentativas: 0, nome: 'Lia Souza', objetivo: null, metas: [], fatos: [],
  estilo: { tamanho: 'curto', emoji: true }, msgsHoje: 1, limiteExcedido: false, ...c,
});
const ctx = { hojeISO: '2026-11-19', horaSP: 20 };
const hamburguer = { tipo: 'refeicao' as const, refeicao: 'jantar' as const, descricao: 'Hambúrguer' };

describe('regras: memória e compra de comida', () => {
  it('"comprei um hambúrguer" sem valor vira refeição; com valor, gasto', () => {
    expect(interpretarPorRegras('comprei um hambúrguer', ctx)).toEqual(hamburguer);
    expect(interpretarPorRegras('comprei um hambúrguer de 32', ctx)).toMatchObject({ tipo: 'gasto', valor: 32, categoria: 'Comida' });
    expect(interpretarPorRegras('comprei um carregador', ctx)).toEqual({ tipo: 'desconhecido' });
  });
  it('fatos: pedido explícito, frase sobre si e esquecer', () => {
    expect(interpretarPorRegras('lembra que não gosto de academia de manhã', ctx)).toEqual({ tipo: 'lembrar', fato: 'Não gosto de academia de manhã' });
    expect(interpretarPorRegras('sou vegetariana', ctx)).toEqual({ tipo: 'lembrar', fato: 'Sou vegetariana' });
    expect(interpretarPorRegras('esquece tudo', ctx)).toEqual({ tipo: 'esquecer' });
    expect(interpretarPorRegras('gastei 30 no uber', ctx)).toMatchObject({ tipo: 'gasto' });
  });
});

describe('ganchoDaMeta (só regra, sem IA)', () => {
  it('hambúrguer + meta emagrecer → dieta/tentação', () => {
    expect(ganchoDaMeta(hamburguer, contato({ objetivo: 'emagrecer' }), {})).toEqual({ tema: 'dieta', motivo: 'tentacao', item: 'Hambúrguer' });
    expect(ganchoDaMeta({ tipo: 'gasto', valor: 32, descricao: 'Pizza', categoria: 'Comida' }, contato({ metas: ['dieta'] }), {})).toMatchObject({ tema: 'dieta' });
  });
  it('sem meta que combine, sem gancho', () => {
    expect(ganchoDaMeta(hamburguer, contato(), {})).toBeNull();
    expect(ganchoDaMeta(hamburguer, contato({ objetivo: 'guardar pra viajar', metas: ['dinheiro'] }), {})).toBeNull();
    expect(ganchoDaMeta({ tipo: 'treino', descricao: 'Peito', duracao_min: 40 }, contato({ objetivo: 'emagrecer', metas: ['dieta'] }), { treinos_semana: 4 })).toBeNull();
    expect(ganchoDaMeta({ tipo: 'gasto', valor: 80, descricao: 'Mercado', categoria: 'Mercado' }, contato({ objetivo: 'guardar pra viajar' }), {})).toBeNull();
  });
  it('dinheiro: lazer com meta de viagem; orçamento estourado', () => {
    const cinema = { tipo: 'gasto' as const, valor: 60, descricao: 'Cinema', categoria: 'Lazer' };
    expect(ganchoDaMeta(cinema, contato({ objetivo: 'guardar pra viajar' }), {})).toEqual({ tema: 'dinheiro', motivo: 'gasto_extra', item: 'Cinema' });
    expect(ganchoDaMeta({ ...cinema, categoria: 'Mercado' }, contato({ metas: ['dinheiro'] }), { categoria: 'Mercado', planejado: 500, gasto_mes: 530 })).toMatchObject({ motivo: 'estourou' });
  });
  it('treino: sequência e volta depois de 7+ dias', () => {
    const t = { tipo: 'treino' as const, descricao: 'Pernas', duracao_min: null };
    expect(ganchoDaMeta(t, contato({ metas: ['treino'] }), { treinos_semana: 3 })).toMatchObject({ motivo: 'sequencia' });
    expect(ganchoDaMeta(t, contato({ objetivo: 'ganhar massa' }), { treinos_semana: 1, dias_sem_treino: 10 })).toMatchObject({ motivo: 'voltou' });
    expect(ganchoDaMeta(t, contato({ metas: ['treino'] }), { treinos_semana: 1, dias_sem_treino: 2 })).toBeNull();
  });
});

describe('persona e comentário (Haiku simulado)', () => {
  beforeEach(() => vi.stubEnv('ANTHROPIC_API_KEY', 'chave-de-teste'));
  afterEach(() => vi.unstubAllEnvs());
  const respostaHaiku = (texto: string) =>
    vi.fn(async () => new Response(JSON.stringify({ content: [{ type: 'text', text: texto }], usage: { input_tokens: 300, output_tokens: 20 } }), { status: 200 }));
  const c = { contato: contato({ objetivo: 'emagrecer', fatos: ['Não gosto de academia de manhã'] }), intencao: hamburguer, gancho: { tema: 'dieta' as const, motivo: 'tentacao' as const, item: 'Hambúrguer' }, hojeISO: '2026-11-19' };

  it('system prompt: amigo engraçado, sem falar de corpo, fatos e meta', () => {
    const s = personaSystem(c.contato, '2026-11-19');
    expect(s).toMatch(/amigo próximo e engraçado/);
    expect(s).toMatch(/Nunca comente corpo, peso/);
    expect(s).toMatch(/Varie as piadas/);
    expect(s).toContain('Não gosto de academia de manhã');
    expect(s).toContain('Objetivo de Lia: emagrecer');
  });

  it('manda meta, fatos e contexto; limita tokens; usa a frase do Haiku', async () => {
    const f = respostaHaiku('Hambúrguer, Lia? A meta de emagrecer tá te olhando de canto 😅');
    const txt = await comentarComHumor({ ...c, extras: { refeicoes_dia: 2, recentes: [{ tipo: 'refeicao', descricao: 'Hambúrguer' }, { tipo: 'refeicao', descricao: 'Pizza' }] } }, f, () => 0);
    expect(txt).toBe('Hambúrguer, Lia? A meta de emagrecer tá te olhando de canto 😅');
    const corpo = JSON.parse(String((f.mock.calls[0] as unknown as [string, RequestInit])[1].body));
    expect(corpo.max_tokens).toBe(80);
    expect(corpo.system).toMatch(/Nunca comente corpo/);
    expect(corpo.messages[0].content).toMatch(/Objetivo: emagrecer/);
    expect(corpo.messages[0].content).toMatch(/Registros recentes \(7 dias\): refeicao Pizza/);
    expect(corpo.messages[0].content).toMatch(/Já te contou: Não gosto de academia de manhã/);
  });

  it('frase fora do tom (corpo/culpa) ou sem resposta cai no texto pronto', async () => {
    expect(await comentarComHumor(c, respostaHaiku('Cuidado pra não ficar gordo, hein'), () => 0)).toBe('Hambúrguer, é? Olha a meta de emagrecer aí, hein 😅');
    vi.stubEnv('ANTHROPIC_API_KEY', '');
    expect(await comentarComHumor(c, respostaHaiku('nunca chamado'), () => 0)).toBe('Hambúrguer, é? Olha a meta de emagrecer aí, hein 😅');
  });

  it('textos prontos variam', () => {
    const a = comentarioPronto(c.gancho, c.contato, () => 0);
    const b = comentarioPronto(c.gancho, c.contato, () => 0.5);
    expect(a).not.toBe(b);
  });

  it('contexto não inventa: só o que veio do banco', () => {
    expect(contextoDoComentario({ ...c, extras: undefined })).not.toMatch(/Orçamento|treino nesta semana/);
  });
});

describe('processarEvento: amigo depois do registro', () => {
  const msg = (body: string) => ({ event: 'message', payload: { id: 'id1', from: '5511988887777@c.us', fromMe: false, body } });
  const base = { ok: true, vinculado: true, etapa: 'concluido', nome: 'Lia Souza', metas: [], fatos: [], estilo_tamanho: 'curto', estilo_emoji: true, msgs_hoje: 1, limite_excedido: false };
  const enviar = vi.fn();
  const comentarIA = vi.fn();
  const registrar = vi.fn();
  const lembrar = vi.fn();
  const deps = (perfil: Record<string, unknown>) => ({
    contato: vi.fn(async () => ({ ...base, ...perfil })), registrar, enviar, comentarIA, lembrar,
    interpretarIA: vi.fn(async () => null), conversarIA: vi.fn(async () => null), agora: new Date('2026-11-19T23:00:00Z'),
  });
  beforeEach(() => {
    vi.stubEnv('WHATSAPP_NUMEROS_PERMITIDOS', '5511988887777');
    enviar.mockReset().mockResolvedValue(true);
    comentarIA.mockReset().mockResolvedValue('Hambúrguer, é? Olha a meta de emagrecer aí, hein 😅');
    registrar.mockReset().mockResolvedValue({ ok: true, nome: 'Lia Souza', extras: { refeicoes_dia: 1, recentes: [] } });
    lembrar.mockReset().mockResolvedValue({ ok: true, total: 1 });
  });
  afterEach(() => vi.unstubAllEnvs());

  it('hambúrguer com meta emagrecer: confirma e comenta (respeitando "sem emoji")', async () => {
    const r = await processarEvento(msg('comprei um hambúrguer'), deps({ objetivo: 'emagrecer', estilo_emoji: false }));
    expect(registrar.mock.calls[0]![2]).toEqual({ tipo: 'refeicao', refeicao: 'jantar', descricao: 'Hambúrguer' });
    expect(comentarIA).toHaveBeenCalledWith(expect.objectContaining({ gancho: { tema: 'dieta', motivo: 'tentacao', item: 'Hambúrguer' } }));
    expect(r).toMatchObject({ status: 'respondido', comentario: true });
    expect(enviar.mock.calls[0]![1]).toBe('Jantar anotado: Hambúrguer.\nHambúrguer, é? Olha a meta de emagrecer aí, hein');
  });

  it('sem meta que combine: não chama a IA nem comenta', async () => {
    const r = await processarEvento(msg('comprei um hambúrguer'), deps({ objetivo: 'guardar pra viajar', metas: ['dinheiro'] }));
    expect(comentarIA).not.toHaveBeenCalled();
    expect(r).not.toHaveProperty('comentario');
    expect(enviar.mock.calls[0]![1]).toBe('🥗 Jantar anotado: Hambúrguer.');
  });

  it('"lembra que…" guarda o fato; "esquece tudo" apaga', async () => {
    await processarEvento(msg('lembra que não gosto de academia de manhã'), deps({}));
    expect(lembrar).toHaveBeenCalledWith('5511988887777', 'Não gosto de academia de manhã');
    expect(enviar.mock.calls[0]![1]).toMatch(/^Guardado, Lia!/);
    await processarEvento(msg('esquece tudo'), deps({}));
    expect(lembrar).toHaveBeenLastCalledWith('5511988887777', null);
    expect(registrar).not.toHaveBeenCalled();
  });
});
