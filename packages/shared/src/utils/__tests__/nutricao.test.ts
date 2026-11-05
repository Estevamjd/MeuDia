import { describe, expect, it } from 'vitest';
import type { ItemRefeicao } from '../../types';
import { lerCelulaTaco, progressoCalorias, seloRefeicao, totalDia, totalNutriente, totalRefeicao, valorNutriente } from '../nutricao';
import { creatinaDoDia } from '../creatina';

const item = (nome: string, calorias: number | null, extra: Partial<ItemRefeicao> = {}): ItemRefeicao => ({ nome, calorias, ...extra });

describe('TACO: "NA", "Tr", "*" e vazio = sem valor, nunca 0', () => {
  it.each(['NA', 'Tr', 'tr', '*', '', '   '])('"%s" → null', (celula) => {
    expect(lerCelulaTaco(celula)).toBeNull();
  });

  it('0 da tabela continua 0; vírgula vira ponto', () => {
    expect(lerCelulaTaco('0')).toBe(0);
    expect(lerCelulaTaco('1,5')).toBe(1.5);
    expect(lerCelulaTaco(12)).toBe(12);
    expect(lerCelulaTaco(null)).toBeNull();
  });

  it('texto desconhecido para com erro (não adivinha)', () => {
    expect(() => lerCelulaTaco('abc')).toThrow('Valor da TACO não reconhecido: "abc"');
    expect(() => lerCelulaTaco('1.2.3')).toThrow();
  });

  it('nutriente do item: só número finito ≥ 0', () => {
    expect(valorNutriente(10)).toBe(10);
    expect(valorNutriente(0)).toBe(0);
    expect(valorNutriente(null)).toBeNull();
    expect(valorNutriente(undefined)).toBeNull();
    expect(valorNutriente(-1)).toBeNull();
  });
});

describe('totais com item sem valor', () => {
  const vitamina = [item('Profit 28500', null), item('leite', 120, { proteina: 6 }), item('banana', null)];

  it('soma só os itens com valor e conta os sem valor', () => {
    expect(totalNutriente(vitamina, 'calorias')).toEqual({ total: 120, semValor: 2, temValor: true });
  });

  it('refeição sem nenhum valor = kcal null ("sem valor"), não 0', () => {
    expect(totalRefeicao({ items: [item('Profit 28500', null)], total_calorias: 0, total_proteina: 0 })).toEqual({
      kcal: null,
      proteina: null,
      itensSemValor: 1,
    });
  });

  it('linha antiga sem itens usa total_calorias', () => {
    expect(totalRefeicao({ items: [], total_calorias: 450, total_proteina: 30 })).toEqual({ kcal: 450, proteina: 30, itensSemValor: 0 });
  });

  it('total do dia avisa os itens sem valor', () => {
    const dia = totalDia([
      { items: vitamina, total_calorias: 120, total_proteina: 6 },
      { items: [item('arroz', 300, { proteina: 6.5 })], total_calorias: 300, total_proteina: 6.5 },
    ]);
    expect(dia).toEqual({ kcal: 420, proteina: 12.5, itensSemValor: 2 });
  });

  it('selo: "ref. TACO" só se todos os itens vieram da TACO', () => {
    expect(seloRefeicao([item('arroz', 128, { fonte: 'taco' })])).toBe('taco');
    expect(seloRefeicao([item('arroz', 128, { fonte: 'taco' }), item('Profit 28500', null, { fonte: 'rotulo' })])).toBe('fora');
    expect(seloRefeicao([item('pão', 300)])).toBe('fora');
    expect(seloRefeicao([])).toBe('fora');
  });
});

describe('meta de calorias do dia: cumprida em 100%, acima sem alerta', () => {
  it('1.930 / 3.102 = 62%', () => {
    const p = progressoCalorias(1930, 3102);
    expect(p).toMatchObject({ pct: 62, cumprida: false, acimaKcal: 0, barraExcedente: 0 });
    expect(p.barraAteMeta).toBeCloseTo(0.622, 3);
  });

  it('exatamente 100% conta como cumprida', () => {
    expect(progressoCalorias(3102, 3102)).toMatchObject({ pct: 100, cumprida: true, acimaKcal: 0, barraAteMeta: 1, barraExcedente: 0 });
  });

  it('3.300 / 3.102 = 106%, 198 acima, barra 94% + 6%', () => {
    const p = progressoCalorias(3300, 3102);
    expect(p).toMatchObject({ pct: 106, cumprida: true, acimaKcal: 198 });
    expect(Math.round(p.barraAteMeta * 100)).toBe(94);
    expect(Math.round(p.barraExcedente * 100)).toBe(6);
  });

  it('meta ausente ou 0 não divide por zero', () => {
    expect(progressoCalorias(500, 0)).toMatchObject({ pct: 0, cumprida: false });
  });
});

describe('creatina do dia sem dobra (BRIEF §3.5)', () => {
  it('avulsa + Profit com rótulo preenchido: soma uma vez cada registro', () => {
    expect(creatinaDoDia([
      { id: 'avulsa', doses: 1, creatina_g: 5 },
      { id: 'profit', doses: 1, creatina_g: 3 },
    ])).toEqual({ totalG: 8, incompleto: false });
  });

  it('o mesmo registro vindo pela refeição não conta de novo', () => {
    const profit = { id: 'profit', doses: 1, creatina_g: 3 };
    expect(creatinaDoDia([profit, { id: 'avulsa', doses: 1, creatina_g: 5 }, profit])).toEqual({ totalG: 8, incompleto: false });
  });

  it('Profit com a creatina vazia: total só da avulsa e aviso de incompleto', () => {
    expect(creatinaDoDia([
      { id: 'profit', doses: 1, creatina_g: null },
      { id: 'avulsa', doses: 1, creatina_g: 5 },
    ])).toEqual({ totalG: 5, incompleto: true });
  });

  it('doses multiplicam a creatina do registro', () => {
    expect(creatinaDoDia([{ id: 'a', doses: 2, creatina_g: 2.5 }])).toEqual({ totalG: 5, incompleto: false });
  });
});
