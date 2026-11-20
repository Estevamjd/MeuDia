import { describe, expect, it } from 'vitest';
import { calcularDescansoSugerido, obterDicaDescanso } from '../treino-analise';

describe('calcularDescansoSugerido', () => {
  it('usa tempo configurado quando disponível', () => {
    expect(calcularDescansoSugerido(90, 50, 1, 3)).toBe(90);
  });

  it('retorna 120s para carga pesada (>80kg)', () => {
    expect(calcularDescansoSugerido(null, 100, 1, 3)).toBe(120);
  });

  it('retorna 90s para carga média (>50kg)', () => {
    expect(calcularDescansoSugerido(null, 60, 1, 3)).toBe(90);
  });

  it('retorna 90s para última série', () => {
    expect(calcularDescansoSugerido(null, 20, 3, 3)).toBe(90);
  });

  it('retorna 60s como padrão', () => {
    expect(calcularDescansoSugerido(null, 20, 1, 3)).toBe(60);
  });

  it('retorna 60s com carga null', () => {
    expect(calcularDescansoSugerido(null, null, 1, 3)).toBe(60);
  });
});

describe('obterDicaDescanso', () => {
  it('retorna dica especial para penúltima série', () => {
    const dica = obterDicaDescanso(2, 3);
    expect(dica).toContain('Última série');
  });

  it('retorna uma dica válida para séries normais', () => {
    const dica = obterDicaDescanso(0, 4);
    expect(typeof dica).toBe('string');
    expect(dica.length).toBeGreaterThan(0);
  });

  it('rotaciona dicas sem repetir padrão imediato', () => {
    const dica1 = obterDicaDescanso(0, 5);
    const dica2 = obterDicaDescanso(1, 5);
    expect(dica1).not.toBe(dica2);
  });
});
