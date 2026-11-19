import { describe, expect, it } from 'vitest';
import { aplicarEstilo, contatoDoRpc } from '../contato';
import { confirmacao as conf, dicasProativas as dicas } from '../respostas';

const sp = (t: string) => t.replace(/\u00a0/g, ' ');
const confirmacao = (...a: Parameters<typeof conf>) => sp(conf(...a));
const dicasProativas = (...a: Parameters<typeof dicas>) => dicas(...a).map(sp);

describe('estilo', () => {
  it('sem emoji remove todos e arruma espaços', () => {
    expect(aplicarEstilo('💪 Treino anotado: Peito. Boa! 🔥', { tamanho: 'curto', emoji: false })).toBe('Treino anotado: Peito. Boa!');
    expect(aplicarEstilo('Oi 😊 tudo bem?', { tamanho: 'curto', emoji: true })).toBe('Oi 😊 tudo bem?');
  });
  it('contatoDoRpc com padrões seguros', () => {
    expect(contatoDoRpc({ ok: true, etapa: 'renda', estilo_emoji: false, metas: ['treino'] })).toMatchObject({
      vinculado: false, etapa: 'renda', metas: ['treino'], estilo: { tamanho: 'curto', emoji: false }, limiteExcedido: false,
    });
  });
});

describe('respostas proativas', () => {
  const gasto = { tipo: 'gasto' as const, valor: 80, descricao: 'Mercado', categoria: 'Mercado' };
  const extras = { categoria: 'Mercado', planejado: 500, gasto_mes: 380, conta_descricao: 'Luz', conta_valor: 120, conta_dia: 22 };
  it('gasto: orçamento restante e conta que vence', () => {
    expect(dicasProativas(gasto, extras)).toEqual(['Ainda tem R$ 120,00 do orçamento de Mercado este mês.', '📅 Lembrete: Luz (R$ 120,00) vence dia 22.']);
    expect(dicasProativas(gasto, { ...extras, gasto_mes: 530 })[0]).toMatch(/^Passou R\$ 30,00 do planejado para Mercado/);
  });
  it('curto mostra só a dica mais útil; detalhado mostra todas', () => {
    expect(confirmacao(gasto, 'Lia Souza', extras).split('\n')).toHaveLength(2);
    expect(confirmacao(gasto, 'Lia', extras, { tamanho: 'detalhado', emoji: true }).split('\n')).toHaveLength(3);
    expect(confirmacao(gasto, 'Lia Souza', extras)).toMatch(/^✅ Anotado, Lia:/);
  });
  it('treino comemora a semana', () => {
    expect(dicasProativas({ tipo: 'treino', descricao: 'Peito', duracao_min: 40 }, { treinos_semana: 3 })).toEqual(['Já são 3 dias de treino nesta semana, tá voando! 🔥']);
  });
  it('sem extras, só a confirmação', () => {
    expect(confirmacao(gasto, null, undefined, { tamanho: 'curto', emoji: false })).toBe('Anotado: gasto de R$ 80,00 · Mercado (Mercado).');
  });
});
