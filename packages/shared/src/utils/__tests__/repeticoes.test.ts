import { describe, expect, it } from 'vitest';
import {
  contarExercicios,
  contarSeries,
  faixaDaLinha,
  formatarFaixaRepeticoes,
  formatarPrescricao,
  lerFaixaRepeticoes,
  SEM_REPETICOES,
} from '../repeticoes';

describe('lerFaixaRepeticoes', () => {
  it.each([
    ['8-12', { min: 8, max: 12 }],
    ['8–12', { min: 8, max: 12 }],
    [' 8 a 12 ', { min: 8, max: 12 }],
    ['10', { min: 10, max: 10 }],
    [10, { min: 10, max: 10 }],
    ['', SEM_REPETICOES],
    [null, SEM_REPETICOES],
  ])('"%s" → %o', (texto, esperado) => {
    expect(lerFaixaRepeticoes(texto)).toEqual(esperado);
  });

  it.each(['12-8', '0', '0-5', 'muitas', '8-', '1000'])('"%s" não é faixa válida (CHECK min ≤ max, min ≥ 1)', (texto) => {
    expect(lerFaixaRepeticoes(texto)).toBeNull();
  });
});

describe('faixaDaLinha', () => {
  it('usa min/max da 008 quando existem', () => {
    expect(faixaDaLinha({ repeticoes_min: 8, repeticoes_max: 12, repeticoes: 8 })).toEqual({ min: 8, max: 12 });
  });

  it('linha antiga (sem 008): `repeticoes` vira número fixo', () => {
    expect(faixaDaLinha({ repeticoes: 12 })).toEqual({ min: 12, max: 12 });
    expect(faixaDaLinha({ repeticoes_min: null, repeticoes_max: null, repeticoes: 15 })).toEqual({ min: 15, max: 15 });
  });

  it('sem nada = série sem repetição', () => {
    expect(faixaDaLinha({ repeticoes_min: null, repeticoes_max: null, repeticoes: null })).toEqual(SEM_REPETICOES);
  });

  it('só um lado preenchido vale como fixo', () => {
    expect(faixaDaLinha({ repeticoes_min: 10, repeticoes_max: null })).toEqual({ min: 10, max: 10 });
  });
});

describe('formatação', () => {
  it('faixa, fixo e sem repetição', () => {
    expect(formatarFaixaRepeticoes({ min: 8, max: 12 })).toBe('8–12');
    expect(formatarFaixaRepeticoes({ min: 10, max: 10 })).toBe('10');
    expect(formatarFaixaRepeticoes(SEM_REPETICOES)).toBe('');
  });

  it('prescrição: "3 × 8–12", "2 × 10" e "3 séries" (prancha)', () => {
    expect(formatarPrescricao(3, { min: 8, max: 12 })).toBe('3 × 8–12');
    expect(formatarPrescricao(2, { min: 10, max: 10 })).toBe('2 × 10');
    expect(formatarPrescricao(3, SEM_REPETICOES)).toBe('3 séries');
    expect(formatarPrescricao(1, SEM_REPETICOES)).toBe('1 série');
  });
});

describe('contarSeries / contarExercicios (QA R1: "1 exercícios · 3 séries")', () => {
  it.each([
    [0, '0 séries', '0 exercícios'],
    [1, '1 série', '1 exercício'],
    [2, '2 séries', '2 exercícios'],
    [12, '12 séries', '12 exercícios'],
  ])('%i → "%s" / "%s"', (n, series, exercicios) => {
    expect(contarSeries(n)).toBe(series);
    expect(contarExercicios(n)).toBe(exercicios);
  });
});
