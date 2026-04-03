import { analisarCarga, calcularDescansoSugerido, obterDicaDescanso } from '../treino.analyzer';

describe('analisarCarga', () => {
  it('retorna MANTER sem histórico', () => {
    const result = analisarCarga([], 20);
    expect(result.sugestao).toBe('MANTER');
    expect(result.cargaAtual).toBe(20);
    expect(result.cargaSugerida).toBe(20);
  });

  it('retorna MANTER com poucas séries', () => {
    const result = analisarCarga(
      [{ carga_usada: 20, reps_feitas: 10, repeticoes_meta: 10, concluido: true }],
      20,
    );
    expect(result.sugestao).toBe('MANTER');
  });

  it('sugere AUMENTAR quando todas séries completas', () => {
    const historico = [
      { carga_usada: 20, reps_feitas: 12, repeticoes_meta: 10, concluido: true },
      { carga_usada: 20, reps_feitas: 11, repeticoes_meta: 10, concluido: true },
      { carga_usada: 20, reps_feitas: 10, repeticoes_meta: 10, concluido: true },
    ];
    const result = analisarCarga(historico, 20);
    expect(result.sugestao).toBe('AUMENTAR');
    expect(result.cargaSugerida).toBeGreaterThan(result.cargaAtual);
  });

  it('sugere REDUZIR quando muito abaixo da meta (<70%)', () => {
    const historico = [
      { carga_usada: 50, reps_feitas: 5, repeticoes_meta: 10, concluido: true },
      { carga_usada: 50, reps_feitas: 4, repeticoes_meta: 10, concluido: true },
      { carga_usada: 50, reps_feitas: 6, repeticoes_meta: 10, concluido: true },
    ];
    const result = analisarCarga(historico, 50);
    expect(result.sugestao).toBe('REDUZIR');
    expect(result.cargaSugerida).toBeLessThan(result.cargaAtual);
  });

  it('ignora séries sem dados válidos', () => {
    const historico = [
      { carga_usada: null, reps_feitas: null, repeticoes_meta: 10, concluido: false },
      { carga_usada: 20, reps_feitas: 10, repeticoes_meta: 10, concluido: true },
    ];
    const result = analisarCarga(historico, 20);
    expect(result.sugestao).toBe('MANTER');
  });
});

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
