import { analisarConsistencia } from '../habito.analyzer';

describe('analisarConsistencia', () => {
  it('retorna resultado vazio sem dados', () => {
    const result = analisarConsistencia([]);
    expect(result.percentualMedio).toBe(0);
    expect(result.diasPerfeitos).toBe(0);
    expect(result.diasTotal).toBe(0);
    expect(result.tendencia).toBe('estavel');
    expect(result.melhorDia).toBeNull();
    expect(result.piorDia).toBeNull();
  });

  it('calcula percentual medio corretamente', () => {
    const registros = [
      { data: '2026-03-28', total: 5, concluidos: 5 },
      { data: '2026-03-29', total: 5, concluidos: 3 },
      { data: '2026-03-30', total: 5, concluidos: 4 },
    ];
    const result = analisarConsistencia(registros);
    // (100 + 60 + 80) / 3 = 80
    expect(result.percentualMedio).toBe(80);
    expect(result.diasTotal).toBe(3);
  });

  it('conta dias perfeitos (100%)', () => {
    const registros = [
      { data: '2026-03-28', total: 3, concluidos: 3 },
      { data: '2026-03-29', total: 3, concluidos: 3 },
      { data: '2026-03-30', total: 3, concluidos: 1 },
    ];
    const result = analisarConsistencia(registros);
    expect(result.diasPerfeitos).toBe(2);
  });

  it('detecta tendência subindo', () => {
    const registros = [
      { data: '2026-03-25', total: 5, concluidos: 1 },
      { data: '2026-03-26', total: 5, concluidos: 1 },
      { data: '2026-03-27', total: 5, concluidos: 2 },
      { data: '2026-03-28', total: 5, concluidos: 4 },
      { data: '2026-03-29', total: 5, concluidos: 5 },
      { data: '2026-03-30', total: 5, concluidos: 5 },
    ];
    const result = analisarConsistencia(registros);
    expect(result.tendencia).toBe('subindo');
    expect(result.mensagem).toContain('📈');
  });

  it('detecta tendência caindo', () => {
    const registros = [
      { data: '2026-03-25', total: 5, concluidos: 5 },
      { data: '2026-03-26', total: 5, concluidos: 5 },
      { data: '2026-03-27', total: 5, concluidos: 4 },
      { data: '2026-03-28', total: 5, concluidos: 2 },
      { data: '2026-03-29', total: 5, concluidos: 1 },
      { data: '2026-03-30', total: 5, concluidos: 1 },
    ];
    const result = analisarConsistencia(registros);
    expect(result.tendencia).toBe('caindo');
    expect(result.mensagem).toContain('📉');
  });

  it('identifica melhor e pior dia', () => {
    const registros = [
      { data: '2026-03-28', total: 5, concluidos: 5 },
      { data: '2026-03-29', total: 5, concluidos: 1 },
      { data: '2026-03-30', total: 5, concluidos: 3 },
    ];
    const result = analisarConsistencia(registros);
    expect(result.melhorDia).toBe('2026-03-28');
    expect(result.piorDia).toBe('2026-03-29');
  });

  it('mensagem excelente para >=90%', () => {
    const registros = [
      { data: '2026-03-28', total: 5, concluidos: 5 },
      { data: '2026-03-29', total: 5, concluidos: 5 },
      { data: '2026-03-30', total: 5, concluidos: 4 },
    ];
    const result = analisarConsistencia(registros);
    expect(result.mensagem).toContain('Excelente');
  });

  it('lida com total 0 sem dividir por zero', () => {
    const registros = [
      { data: '2026-03-28', total: 0, concluidos: 0 },
    ];
    const result = analisarConsistencia(registros);
    expect(result.percentualMedio).toBe(0);
  });
});
