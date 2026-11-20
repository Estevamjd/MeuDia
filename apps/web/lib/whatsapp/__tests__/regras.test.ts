import { describe, expect, it } from 'vitest';
import { extrairValor, interpretarPorRegras } from '../regras';

const ctx = { hojeISO: '2026-11-19', horaSP: 13 };
const ler = (m: string) => interpretarPorRegras(m, ctx);

describe('extrairValor', () => {
  it.each([
    ['gastei 45,90 no mercado', 45.9],
    ['paguei R$ 1.200 de aluguel', 1200],
    ['1.234,56 de mercado', 1234.56],
    ['uber 23', 23],
    ['12.5 de café', 12.5],
  ])('%s → %s', (texto, valor) => expect(extrairValor(texto)?.valor).toBe(valor));

  it('sem número ou zero → null', () => {
    expect(extrairValor('gastei no mercado')).toBeNull();
    expect(extrairValor('gastei 0')).toBeNull();
  });
});

describe('interpretarPorRegras', () => {
  it('gasto com categoria pelo texto', () => {
    expect(ler('gastei 45,90 no mercado')).toEqual({ tipo: 'gasto', valor: 45.9, descricao: 'Mercado', categoria: 'Mercado' });
    expect(ler('uber 23')).toMatchObject({ tipo: 'gasto', valor: 23, categoria: 'Transporte' });
    expect(ler('paguei 120 de luz')).toMatchObject({ tipo: 'gasto', categoria: 'Luz' });
    expect(ler('comprei 80 numa coisa qualquer')).toMatchObject({ tipo: 'gasto', categoria: 'Outros' });
  });

  it('entrada', () => {
    expect(ler('recebi 500 do freela')).toMatchObject({ tipo: 'entrada', valor: 500, categoria: 'Entrada extra' });
    expect(ler('caiu o salário 3.000')).toMatchObject({ tipo: 'entrada', valor: 3000, categoria: 'Salário' });
  });

  it('treino com minutos ou horas', () => {
    expect(ler('treinei peito 40min')).toEqual({ tipo: 'treino', descricao: 'Peito', duracao_min: 40 });
    expect(ler('treinei pernas 1h30')).toEqual({ tipo: 'treino', descricao: 'Pernas', duracao_min: 90 });
    expect(ler('corri 5km 30 minutos')).toEqual({ tipo: 'treino', descricao: 'Corrida 5km', duracao_min: 30 });
    expect(ler('malhei')).toEqual({ tipo: 'treino', descricao: 'Treino', duracao_min: null });
  });

  it('refeição pelo verbo, ou pela hora em "comi"', () => {
    expect(ler('almocei arroz, feijão, frango')).toEqual({ tipo: 'refeicao', refeicao: 'almoco', descricao: 'Arroz, feijão, frango' });
    expect(ler('café da manhã: pão e ovo')).toEqual({ tipo: 'refeicao', refeicao: 'cafe', descricao: 'Pão e ovo' });
    expect(ler('jantei sopa')).toMatchObject({ refeicao: 'jantar' });
    expect(ler('comi uma maçã')).toEqual({ tipo: 'refeicao', refeicao: 'almoco', descricao: 'Maçã' });
  });

  it('"almoço 35 reais" é gasto, não refeição', () => {
    expect(ler('almoço 35 reais')).toMatchObject({ tipo: 'gasto', valor: 35, categoria: 'Restaurante' });
  });

  it('"ontem" vira a data de ontem', () => {
    expect(ler('treinei costas ontem 50 min')).toEqual({ tipo: 'treino', descricao: 'Costas', duracao_min: 50, data: '2026-11-18' });
    expect(ler('gastei 30 no ifood ontem')).toMatchObject({ categoria: 'Comida', data: '2026-11-18' });
  });

  it('ajuda e desconhecido', () => {
    expect(ler('oi')).toEqual({ tipo: 'ajuda' });
    expect(ler('Ajuda')).toEqual({ tipo: 'ajuda' });
    expect(ler('como está o tempo')).toEqual({ tipo: 'desconhecido' });
    expect(ler('   ')).toEqual({ tipo: 'desconhecido' });
  });
});

describe('desfazer WhatsApp', () => {
  it.each(['desfazer', 'desfaz', 'apaga o último', 'cancela o último', 'apagar último!', 'cancelar o último.', 'apaga o último registro', 'apagar o último', 'cancela o último gasto', 'desfaz o último', 'desfazer o último lançamento'])('%s', (texto) => {
    expect(interpretarPorRegras(texto, { hojeISO: '2026-11-20', horaSP: 12 })).toEqual({ tipo: 'desfazer' });
  });
});

it.each(['gastei 45 no mercado', 'almoço 32 reais', 'gastei 20 no último café', 'apaga o último registro de 50 reais'])('não desfaz ao receber %s', (texto) => {
  expect(ler(texto).tipo).not.toBe('desfazer');
});

it.each([['paguei 5 de luz', 5], ['paguei 120 de luz', 120], ['paguei 119,50 de luz', 119.5], ['paguei 118 de luz', 118], ['paguei a luz', null]])('%s preserva pagar e valor', (texto, valor) => {
  expect(ler(String(texto))).toMatchObject({ tipo: 'gasto', pagar: true, valor, descricao: 'Luz' });
});
