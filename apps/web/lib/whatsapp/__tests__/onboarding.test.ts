import { describe, expect, it, vi } from 'vitest';
import type { Contato } from '../contato';
import { BOAS_VINDAS, metasPorRegra, nomePorRegra, passoOnboarding, rendaPorRegra } from '../onboarding';

const contato = (c: Partial<Contato> = {}): Contato => ({
  vinculado: false, etapa: 'inicio', tentativas: 0, nome: null, objetivo: null, metas: [],
  estilo: { tamanho: 'curto', emoji: true }, msgsHoje: 1, limiteExcedido: false, ...c,
});
const semIA = vi.fn(async () => null);

describe('regras do onboarding', () => {
  it.each([['Estevam', 'Estevam'], ['meu nome é joão pedro', 'João Pedro'], ['Oi! me chamo Lia.', 'Lia'], ['sou o Caio', 'Caio']])('nome "%s" → %s', (t, n) =>
    expect(nomePorRegra(t)).toBe(n));
  it('nome: frase longa ou número → não entende (vai para a IA)', () => {
    expect(nomePorRegra('pode ser qualquer coisa que você quiser mesmo')).toBeNull();
    expect(nomePorRegra('123')).toBeNull();
  });
  it.each([['3.500', 3500], ['uns 3 mil', 3000], ['4,5 mil', 4500], ['R$ 2.800 por mês', 2800], ['3k', 3000], ['5 mil e 200', 5200]])('renda "%s" → %s', (t, v) =>
    expect(rendaPorRegra(t)).toBe(v));
  it('renda: valores absurdos ou sem número → null', () => {
    expect(rendaPorRegra('3')).toBeNull();
    expect(rendaPorRegra('depende do mês')).toBeNull();
  });
  it('metas por palavras', () => {
    expect(metasPorRegra('tudo')).toEqual(['dinheiro', 'treino', 'dieta']);
    expect(metasPorRegra('quero guardar grana e voltar pra academia')).toEqual(['dinheiro', 'treino']);
    expect(metasPorRegra('emagrecer')).toEqual(['dieta']);
    expect(metasPorRegra('sei lá, organizar a vida')).toBeNull();
  });
});

describe('passoOnboarding', () => {
  it('primeira mensagem: boas-vindas com aviso de IA e pergunta o nome', async () => {
    const p = await passoOnboarding(contato(), 'oi', semIA);
    expect(p).toEqual({ dados: { etapa: 'nome', tentativas: 0 }, gerarToken: false, resposta: BOAS_VINDAS });
    expect(p.resposta).toMatch(/inteligência artificial/);
    expect(p.resposta).toMatch(/pular/);
  });

  it('caminho feliz: nome → renda → objetivo → metas → estilo → link, uma pergunta por vez', async () => {
    let p = await passoOnboarding(contato({ etapa: 'nome' }), 'Lia', semIA);
    expect(p.dados).toEqual({ nome: 'Lia', etapa: 'renda', tentativas: 0 });
    expect(p.resposta).toMatch(/^Prazer, Lia!.*recebe por mês/);
    p = await passoOnboarding(contato({ etapa: 'renda', nome: 'Lia' }), 'uns 3 mil', semIA);
    expect(p.dados).toEqual({ renda: 3000, etapa: 'objetivo', tentativas: 0 });
    p = await passoOnboarding(contato({ etapa: 'objetivo', nome: 'Lia' }), 'guardar pra viajar', semIA);
    expect(p.dados).toEqual({ objetivo: 'guardar pra viajar', etapa: 'metas', tentativas: 0 });
    p = await passoOnboarding(contato({ etapa: 'metas', nome: 'Lia' }), 'dinheiro e treino', semIA);
    expect(p.dados).toEqual({ metas: ['dinheiro', 'treino'], etapa: 'estilo', tentativas: 0 });
    p = await passoOnboarding(contato({ etapa: 'estilo', nome: 'Lia' }), 'curtas e sem emoji', semIA);
    expect(p.dados).toEqual({ estilo_tamanho: 'curto', estilo_emoji: false, etapa: 'link', tentativas: 0 });
    expect(p.gerarToken).toBe(true);
    expect(p.resposta).toContain('{LINK}');
    expect(p.resposta).toMatch(/^Prontinho, Lia!/);
    expect(p.resposta).not.toMatch(/✅/); // já respeita "sem emoji"
    expect(semIA).not.toHaveBeenCalled();
  });

  it('"pular" segue sem o dado', async () => {
    const p = await passoOnboarding(contato({ etapa: 'renda' }), 'prefiro não dizer', semIA);
    expect(p.dados).toEqual({ etapa: 'objetivo', tentativas: 0 });
    const n = await passoOnboarding(contato({ etapa: 'nome' }), 'pular', semIA);
    expect(n.resposta).toMatch(/^Combinado!/);
  });

  it('não entendeu: repergunta com exemplo; na 2ª tentativa segue sem prender', async () => {
    const ia = vi.fn(async () => null);
    let p = await passoOnboarding(contato({ etapa: 'renda' }), 'depende do mês', ia);
    expect(ia).toHaveBeenCalledWith('renda', 'depende do mês');
    expect(p.dados).toEqual({ tentativas: 1 });
    expect(p.resposta).toMatch(/Não peguei o valor/);
    p = await passoOnboarding(contato({ etapa: 'renda', tentativas: 1 }), 'varia', ia);
    expect(p.dados).toEqual({ etapa: 'objetivo', tentativas: 0 });
    expect(p.resposta).toMatch(/^Sem problema, seguimos sem isso\./);
  });

  it('IA entende o que a regra não entendeu', async () => {
    const ia = vi.fn(async (etapa: string) => (etapa === 'nome' ? { nome: 'Bia' } : { metas: ['dieta' as const] }));
    const p = await passoOnboarding(contato({ etapa: 'nome' }), 'pode me chamar do jeito que minha avó chama, Bia', ia);
    expect(p.dados).toMatchObject({ nome: 'Bia', etapa: 'renda' });
    const m = await passoOnboarding(contato({ etapa: 'metas' }), 'quero caber no vestido da formatura', ia);
    expect(m.dados).toMatchObject({ metas: ['dieta'], etapa: 'estilo' });
  });

  it('estilo sem resposta clara usa o padrão e não repergunta', async () => {
    const p = await passoOnboarding(contato({ etapa: 'estilo' }), 'tanto faz', semIA);
    expect(p.dados).toEqual({ etapa: 'link', tentativas: 0 });
    expect(p.gerarToken).toBe(true);
  });

  it('já no link: manda um link novo', async () => {
    const p = await passoOnboarding(contato({ etapa: 'link', estilo: { tamanho: 'curto', emoji: false } }), 'cadê?', semIA);
    expect(p).toMatchObject({ dados: {}, gerarToken: true });
    expect(p.resposta).toContain('{LINK}');
  });
});
