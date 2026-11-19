import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { candidatoDoRpc, emSilencio, escolherLembrete, horaDoTreino, relogioSP, sorteio, type Candidato } from '../lembretes';
import { interpretarPorRegras } from '../regras';

vi.mock('server-only', () => ({}));
const { rodarLembretes } = await import('../lembretes-rodada');
const { escreverLembrete, textoPronto, AVISO_PRIMEIRA } = await import('../lembretes-texto');
const { processarEvento } = await import('../processar');

const SP = (dia: string, hm: string) => new Date(`${dia}T${hm}:00-03:00`);
const SEG = '2026-11-23'; // segunda
const cand = (c: Partial<Candidato> = {}): Candidato => ({
  telefone: '5511955554444', nome: 'Lia Teste', objetivo: null, metas: [], fatos: [], estilo: { tamanho: 'curto', emoji: true },
  lembreteHora: null, horaInferida: null, enviosHoje: 0, enviosTotal: 3, enviosSemResposta: 0, chaves7d: [],
  treinoHoje: null, treinouHoje: false, gastosHoje: 1, refeicoesHoje: 1, contas: [], ...c,
});
/** Telefone cujo sorteio do dia para `tipo` cai abaixo (ou acima) do limite. */
function telefoneCom(tipo: string, abaixoDe: number, sim: boolean, dia = SEG): string {
  for (let i = 0; i < 500; i++) {
    const tel = `55119000${String(i).padStart(5, '0')}`;
    if ((sorteio(tel, dia, tipo) < abaixoDe) === sim) return tel;
  }
  throw new Error('sem telefone');
}

describe('relógio e silêncio', () => {
  it('horário de São Paulo e silêncio 22h–8h', () => {
    expect(relogioSP(SP(SEG, '07:59'))).toEqual({ dia: SEG, minutos: 7 * 60 + 59 });
    expect(emSilencio(7 * 60 + 59)).toBe(true);
    expect(emSilencio(8 * 60)).toBe(false);
    expect(emSilencio(21 * 60 + 59)).toBe(false);
    expect(emSilencio(22 * 60)).toBe(true);
  });
  it('hora do treino: preferida > plano − 1h > costume − 1h > 18h, sempre entre 8h e 21h', () => {
    expect(horaDoTreino({ lembreteHora: 7, treinoHoje: null, horaInferida: null })).toBe(8);
    expect(horaDoTreino({ lembreteHora: null, treinoHoje: { nome: 'Perna', hora: 19 }, horaInferida: 7 })).toBe(18);
    expect(horaDoTreino({ lembreteHora: null, treinoHoje: { nome: 'Perna', hora: null }, horaInferida: 7 })).toBe(8);
    expect(horaDoTreino({ lembreteHora: null, treinoHoje: { nome: 'Perna', hora: null }, horaInferida: null })).toBe(18);
    expect(horaDoTreino({ lembreteHora: null, treinoHoje: { nome: 'Perna', hora: 23 }, horaInferida: null })).toBe(21);
  });
});

describe('escolherLembrete', () => {
  const perna = { nome: 'Perna', hora: null };

  it('treino do plano: lembra depois das 18h (+ atraso aleatório) e antes de 21h', () => {
    const c = cand({ treinoHoje: perna });
    expect(escolherLembrete(c, SP(SEG, '17:59'))).toBeNull();
    expect(escolherLembrete(c, SP(SEG, '18:45'))).toEqual({ tipo: 'treino', chave: `treino:${SEG}`, dados: { treino: 'Perna' } });
    expect(escolherLembrete(c, SP(SEG, '21:05'))).toBeNull();
  });

  it('jitter: o horário exato varia por pessoa, mas fica entre o alvo e alvo+40min', () => {
    const minutosDeInicio = ['5511900000001', '5511900000002', '5511900000003', '5511900000004'].map((tel) => {
      for (let m = 0; m <= 45; m++) if (escolherLembrete(cand({ telefone: tel, treinoHoje: perna }), new Date(SP(SEG, '18:00').getTime() + m * 60000))) return m;
      return -1;
    });
    expect(minutosDeInicio.every((m) => m >= 0 && m < 40)).toBe(true);
    expect(new Set(minutosDeInicio).size).toBeGreaterThan(1);
  });

  it('já treinou (app ou WhatsApp): não lembra; às vezes só parabeniza (no máx. 2 por semana)', () => {
    const sorteado = telefoneCom('parabens', 0.3, true);
    const naoSorteado = telefoneCom('parabens', 0.3, false);
    expect(escolherLembrete(cand({ telefone: naoSorteado, treinoHoje: perna, treinouHoje: true }), SP(SEG, '19:00'))).toBeNull();
    expect(escolherLembrete(cand({ telefone: sorteado, treinoHoje: perna, treinouHoje: true }), SP(SEG, '19:00'))).toMatchObject({ tipo: 'parabens' });
    expect(escolherLembrete(cand({ telefone: sorteado, treinoHoje: perna, treinouHoje: true, chaves7d: ['parabens:2026-11-19', 'parabens:2026-11-21'] }), SP(SEG, '19:00'))).toBeNull();
  });

  it('sem treino no plano de hoje: nada de lembrete de treino', () => {
    expect(escolherLembrete(cand({ treinoHoje: null }), SP(SEG, '19:00'))).toBeNull();
  });

  it('check-in da noite: só sem gasto no dia, em dias sorteados e até 3x por semana', () => {
    const tel = telefoneCom('checkin', 0.55, true);
    expect(escolherLembrete(cand({ telefone: tel, gastosHoje: 0 }), SP(SEG, '20:45'))).toEqual({ tipo: 'checkin', chave: `checkin:${SEG}`, dados: {} });
    expect(escolherLembrete(cand({ telefone: tel, gastosHoje: 1 }), SP(SEG, '20:45'))).toBeNull();
    expect(escolherLembrete(cand({ telefone: tel, gastosHoje: 0, chaves7d: ['checkin:a', 'checkin:b', 'checkin:c'] }), SP(SEG, '20:45'))).toBeNull();
    expect(escolherLembrete(cand({ telefone: telefoneCom('checkin', 0.55, false), gastosHoje: 0 }), SP(SEG, '20:45'))).toBeNull();
  });

  it('check-in varia: em 4 semanas, cai em ~55% dos dias, nunca todo dia', () => {
    let dias = 0;
    for (let d = 1; d <= 28; d++) {
      const dia = `2026-12-${String(d).padStart(2, '0')}`;
      if (escolherLembrete(cand({ gastosHoje: 0 }), SP(dia, '20:45'))) dias++;
    }
    expect(dias).toBeGreaterThan(5);
    expect(dias).toBeLessThan(28);
  });

  it('conta que vence: de manhã, uma vez por conta e vencimento', () => {
    const luz = { id: 'c1', descricao: 'Luz', valor: 120, vence: '2026-11-24' };
    expect(escolherLembrete(cand({ contas: [luz] }), SP(SEG, '10:00'))).toEqual({ tipo: 'conta', chave: 'conta:c1:2026-11-24', dados: { conta: 'Luz', valor: 120, vence: '2026-11-24', hoje: SEG } });
    expect(escolherLembrete(cand({ contas: [luz], chaves7d: ['conta:c1:2026-11-24'] }), SP(SEG, '10:00'))).toBeNull();
    expect(escolherLembrete(cand({ contas: [luz] }), SP(SEG, '13:00'))).toBeNull();
  });

  it('refeição: só com meta de alimentação e sem refeição no dia', () => {
    const tel = telefoneCom('refeicao', 0.4, true);
    expect(escolherLembrete(cand({ telefone: tel, refeicoesHoje: 0, objetivo: 'emagrecer' }), SP(SEG, '13:20'))).toMatchObject({ tipo: 'refeicao' });
    expect(escolherLembrete(cand({ telefone: tel, refeicoesHoje: 0, objetivo: 'guardar dinheiro' }), SP(SEG, '13:20'))).toBeNull();
    expect(escolherLembrete(cand({ telefone: tel, refeicoesHoje: 1, metas: ['dieta'] }), SP(SEG, '13:20'))).toBeNull();
  });

  it('tetos: 2 por dia, silêncio e parar depois de 3 sem resposta', () => {
    const c = { treinoHoje: perna };
    expect(escolherLembrete(cand({ ...c, enviosHoje: 2 }), SP(SEG, '19:00'))).toBeNull();
    expect(escolherLembrete(cand({ ...c, enviosSemResposta: 3 }), SP(SEG, '19:00'))).toBeNull();
    expect(escolherLembrete(cand({ ...c, lembreteHora: 21 }), SP(SEG, '22:10'))).toBeNull();
  });

  it('prioridade: conta antes de treino (um por rodada)', () => {
    const c = cand({ treinoHoje: perna, lembreteHora: 10, contas: [{ id: 'c1', descricao: 'Luz', valor: 120, vence: SEG }] });
    expect(escolherLembrete(c, SP(SEG, '11:00'))?.tipo).toBe('conta');
    expect(escolherLembrete({ ...c, chaves7d: [`conta:c1:${SEG}`] }, SP(SEG, '11:00'))?.tipo).toBe('treino');
  });

  it('candidatoDoRpc', () => {
    expect(candidatoDoRpc({ telefone: '5511', nome: 'Lia', metas: ['treino'], estilo_emoji: false, treino_hoje: { nome: 'Perna', hora: 19 }, contas: [{ id: 'x', descricao: 'Luz', valor: '120.00', vence: SEG }] }))
      .toMatchObject({ estilo: { emoji: false }, treinoHoje: { nome: 'Perna', hora: 19 }, contas: [{ valor: 120 }] });
  });
});

describe('opt-out pelo chat', () => {
  const ctx = { hojeISO: SEG, horaSP: 12 };
  it.each([
    ['parar lembretes', { ativos: false, hora: null }], ['pare', { ativos: false, hora: null }], ['para de me lembrar', { ativos: false, hora: null }],
    ['desativa os lembretes', { ativos: false, hora: null }], ['voltar lembretes', { ativos: true, hora: null }], ['quero os lembretes', { ativos: true, hora: null }],
    ['lembretes às 19h', { ativos: null, hora: 19 }], ['me lembra de treinar às 7', { ativos: null, hora: 7 }],
  ])('"%s"', (t, esperado) => expect(interpretarPorRegras(t, ctx)).toEqual({ tipo: 'lembretes', ...esperado }));
  it('"lembra que…" continua sendo fato', () => {
    expect(interpretarPorRegras('lembra que não gosto de academia de manhã', ctx)).toMatchObject({ tipo: 'lembrar' });
  });

  it('processar: para, volta e valida a hora', async () => {
    vi.stubEnv('WHATSAPP_NUMEROS_PERMITIDOS', '5511988887777');
    const lembretes = vi.fn(async () => ({ ok: true }));
    const enviar = vi.fn(async (_chat: string, _texto: string) => true);
    const deps = {
      lembretes, enviar, registrar: vi.fn(), interpretarIA: vi.fn(async () => null), conversarIA: vi.fn(async () => null),
      contato: vi.fn(async () => ({ ok: true, vinculado: true, etapa: 'concluido', nome: 'Lia', metas: [], fatos: [], estilo_tamanho: 'curto', estilo_emoji: true, msgs_hoje: 1 })),
    };
    const msg = (body: string) => ({ event: 'message', payload: { id: 'x', from: '5511988887777@c.us', body } });
    await processarEvento(msg('parar lembretes'), deps);
    expect(lembretes).toHaveBeenLastCalledWith('5511988887777', false, null);
    expect(enviar.mock.calls[0]![1]).toMatch(/parei os lembretes/);
    await processarEvento(msg('voltar lembretes'), deps);
    expect(lembretes).toHaveBeenLastCalledWith('5511988887777', true, null);
    await processarEvento(msg('lembretes às 23h'), deps);
    expect(lembretes).toHaveBeenCalledTimes(2);
    expect(enviar.mock.calls[2]![1]).toMatch(/entre 8h e 21h/);
    vi.unstubAllEnvs();
  });
});

describe('texto do lembrete (Haiku simulado)', () => {
  beforeEach(() => vi.stubEnv('ANTHROPIC_API_KEY', 'chave-de-teste'));
  afterEach(() => vi.unstubAllEnvs());
  const haiku = (texto: string) => vi.fn(async () => new Response(JSON.stringify({ content: [{ type: 'text', text: texto }], usage: { input_tokens: 300, output_tokens: 20 } }), { status: 200 }));
  const treino = { tipo: 'treino' as const, chave: `treino:${SEG}`, dados: { treino: 'Perna' } };

  it('usa o Haiku com tokens limitados, fatos e regras de tom', async () => {
    const f = haiku('Hoje é dia de perna, Lia! Bora? 🦵');
    const txt = await escreverLembrete(cand({ fatos: ['Não gosto de academia de manhã'] }), treino, SEG, true, f);
    expect(txt).toBe('Hoje é dia de perna, Lia! Bora? 🦵');
    const corpo = JSON.parse(String((f.mock.calls[0] as unknown as [string, RequestInit])[1].body));
    expect(corpo.max_tokens).toBe(70);
    expect(corpo.system).toMatch(/Nunca comente corpo/);
    expect(corpo.messages[0].content).toMatch(/"Perna"/);
    expect(corpo.messages[0].content).toMatch(/Não gosto de academia de manhã/);
  });

  it('fora do tom, sem chave ou dry-run sem IA: texto pronto; sem emoji respeitado; aviso de opt-out só no 1º', async () => {
    expect(await escreverLembrete(cand(), treino, SEG, true, haiku('Bora, preguiçosa!'))).toBe(textoPronto(cand(), treino, SEG));
    const f = haiku('nunca');
    const primeira = await escreverLembrete(cand({ enviosTotal: 0, estilo: { tamanho: 'curto', emoji: false } }), treino, SEG, false, f);
    expect(f).not.toHaveBeenCalled();
    expect(primeira).toContain(AVISO_PRIMEIRA);
    expect(primeira).not.toMatch(/💪|🏋️|😉/);
  });

  it('conta: se o Haiku errar o valor, usa o pronto (com valor e vencimento certos)', async () => {
    const conta = { tipo: 'conta' as const, chave: 'conta:c1:2026-11-24', dados: { conta: 'Luz', valor: 120, vence: '2026-11-24', hoje: SEG } };
    const txt = await escreverLembrete(cand(), conta, SEG, true, haiku('A conta de luz de R$ 150 vence logo!'));
    expect(txt.replace(/\u00a0/g, ' ')).toMatch(/Luz.*R\$ 120,00.*amanhã/);
  });
});

describe('rodarLembretes', () => {
  const cru = { telefone: '5511955554444', nome: 'Lia', metas: [], fatos: [], estilo_tamanho: 'curto', estilo_emoji: true, envios_hoje: 0, envios_total: 2, envios_sem_resposta: 0, chaves_7d: [], treino_hoje: { nome: 'Perna', hora: null }, treinou_hoje: false, gastos_hoje: 1, refeicoes_hoje: 1, contas: [] };
  const deps = () => ({
    candidatos: vi.fn(async () => ({ ok: true, candidatos: [cru, { ...cru, telefone: '5511955553333' }] })),
    reservar: vi.fn(async () => ({ ok: true, id: 1 })),
    marcar: vi.fn(async () => ({ ok: true })),
    enviar: vi.fn(async () => true),
    digitar: vi.fn(async () => undefined),
    sessao: vi.fn(async () => 'WORKING'),
    escrever: vi.fn(async () => 'Hoje é dia de perna, bora?'),
    esperar: vi.fn(async (_ms: number) => undefined),
    aleatorio: () => 0.5,
  });
  const agora = SP(SEG, '19:00');
  afterEach(() => vi.unstubAllEnvs());

  it('interruptor global desligado: não faz nada', async () => {
    vi.stubEnv('WHATSAPP_LEMBRETES_ATIVOS', 'false');
    const d = deps();
    expect(await rodarLembretes({ dry: false, agora }, d)).toEqual({ ok: true, desligado: true });
    expect(d.candidatos).not.toHaveBeenCalled();
  });

  it('sem sessão do WAHA conectada: planeja, mas não reserva nem envia', async () => {
    vi.stubEnv('WHATSAPP_LEMBRETES_ATIVOS', 'true');
    const d = deps();
    d.sessao.mockResolvedValue('SCAN_QR_CODE');
    expect(await rodarLembretes({ dry: false, agora }, d)).toEqual({ ok: true, sessao: 'SCAN_QR_CODE', planejados: 2, enviados: 0 });
    expect(d.reservar).not.toHaveBeenCalled();
    expect(d.enviar).not.toHaveBeenCalled();
  });

  it('envia: reserva antes, "digitando…", pausa entre pessoas, marca e mascara o número', async () => {
    vi.stubEnv('WHATSAPP_LEMBRETES_ATIVOS', 'true');
    const d = deps();
    const r = await rodarLembretes({ dry: false, agora }, d);
    expect(r).toMatchObject({ ok: true, sessao: 'WORKING', planejados: 2, enviados: 2 });
    expect(d.reservar).toHaveBeenCalledWith(expect.any(String), 'treino', `treino:${SEG}`);
    expect(d.digitar).toHaveBeenCalledWith(expect.stringMatching(/@c\.us$/), true);
    expect(d.esperar.mock.calls.some(([ms]) => ms >= 8000)).toBe(true); // fila global
    expect(d.marcar).toHaveBeenCalledWith(1, 'enviado');
    expect(JSON.stringify(r)).not.toContain('5511955554444');
  });

  it('reserva recusada (teto/repetido/sem opt-in) pula; falha de envio para a rodada', async () => {
    vi.stubEnv('WHATSAPP_LEMBRETES_ATIVOS', 'true');
    const d = deps();
    d.reservar.mockResolvedValueOnce({ ok: false, erro: 'limite_dia' } as never);
    let r = await rodarLembretes({ dry: false, agora }, d);
    expect(r).toMatchObject({ enviados: 1 });
    const d2 = deps();
    d2.enviar.mockResolvedValue(false);
    r = await rodarLembretes({ dry: false, agora }, d2);
    expect(r).toMatchObject({ enviados: 0 });
    expect(d2.enviar).toHaveBeenCalledTimes(1);
    expect(d2.marcar).toHaveBeenCalledWith(1, 'falhou');
  });

  it('dry-run: devolve os textos, sem sessão, reserva nem envio (funciona com o interruptor desligado)', async () => {
    vi.stubEnv('WHATSAPP_LEMBRETES_ATIVOS', 'false');
    const d = deps();
    const r = await rodarLembretes({ dry: true, agora }, d);
    expect(r).toMatchObject({ ok: true, sessao: 'DRY_RUN', planejados: 2, enviados: 0 });
    expect(d.candidatos).toHaveBeenCalledWith(agora);
    expect(d.sessao).not.toHaveBeenCalled();
    expect(d.reservar).not.toHaveBeenCalled();
    expect(d.enviar).not.toHaveBeenCalled();
  });
});
