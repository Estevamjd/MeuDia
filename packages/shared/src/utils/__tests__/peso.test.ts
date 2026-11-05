import { describe, expect, it } from 'vitest';
import { diasEntre, mediaPeso, metaRealista, ritmoKgSemana, serieGraficoPeso, ultimoPeso } from '../peso';
import { somarDias } from '../saldo';

const reg = (data: string, peso: number) => ({ data, peso });

describe('médias de peso 7/30/90 dias', () => {
  const registros = [
    reg('2026-10-27', 70.0),
    reg('2026-10-29', 70.4),
    reg('2026-10-31', 70.8),
    reg('2026-11-02', 71.2),
    reg('2026-10-01', 68.0),
    reg('2026-08-10', 66.0),
  ];

  it('7 dias: só os registros de 27/10 a 02/11', () => {
    expect(mediaPeso(registros, '2026-11-02', 7)).toBe(70.6);
  });

  it('30 dias começa em 04/10 (sem 01/10); 33 dias pega 01/10; 90 dias pega todos', () => {
    expect(mediaPeso(registros, '2026-11-02', 30)).toBe(70.6);
    expect(mediaPeso(registros, '2026-11-02', 33)).toBe(70.08);
    expect(mediaPeso(registros, '2026-11-02', 90)).toBe(69.4);
  });

  it('janela sem registro = null (nunca 0)', () => {
    expect(mediaPeso(registros, '2026-12-31', 7)).toBeNull();
    expect(mediaPeso([], '2026-11-02', 90)).toBeNull();
  });

  it('série do gráfico: um ponto por dia, peso do dia e média móvel de 7 dias', () => {
    const s = serieGraficoPeso(registros, '2026-11-02', 7);
    expect(s).toHaveLength(7);
    expect(s[0]).toEqual({ data: '2026-10-27', peso: 70, media7: 70 });
    expect(s[1]).toEqual({ data: '2026-10-28', peso: null, media7: 70 });
    expect(s[6]).toEqual({ data: '2026-11-02', peso: 71.2, media7: 70.6 });
  });

  it('último peso é o de data mais recente', () => {
    expect(ultimoPeso(registros)).toEqual(reg('2026-11-02', 71.2));
    expect(ultimoPeso([])).toBeNull();
  });

  it('datas de calendário atravessam mês e ano', () => {
    expect(somarDias('2026-12-30', 3)).toBe('2027-01-02');
    expect(diasEntre('2026-11-02', '2027-01-25')).toBe(84);
  });
});

describe('ritmo e meta realista (Iraki 2019: 0,25–0,5% do peso por semana)', () => {
  it('0,375% de 71,3 kg ≈ 0,27 kg/semana', () => {
    expect(ritmoKgSemana(0.375, 71.3)).toBe(0.27);
  });

  it('exemplo da tela 04: 71,3 → 75 até 25 jan pede 0,31 kg/semana; referência 0,18–0,36; realista', () => {
    expect(metaRealista({ pesoMetaKg: 75, pesoAtualKg: 71.3, hoje: '2026-11-02', prazo: '2027-01-25' })).toEqual({
      semanas: 12,
      pedidoKgSemana: 0.31,
      refMinKgSemana: 0.18,
      refMaxKgSemana: 0.36,
      realista: true,
    });
  });

  it('conta do anexo: 66,5 → 75 kg em 1 ou 3 meses não é realista; em ~26 semanas é', () => {
    const base = { pesoMetaKg: 75, pesoAtualKg: 66.5, hoje: '2026-11-04' };
    expect(metaRealista({ ...base, prazo: '2026-12-04' })!.realista).toBe(false);
    expect(metaRealista({ ...base, prazo: '2027-02-04' })!.realista).toBe(false);
    const r = metaRealista({ ...base, prazo: somarDias('2026-11-04', 26 * 7) })!;
    expect(r.refMinKgSemana).toBe(0.17);
    expect(r.refMaxKgSemana).toBe(0.33);
    expect(r.realista).toBe(true);
  });

  it('prazo hoje ou no passado: sem conta', () => {
    expect(metaRealista({ pesoMetaKg: 75, pesoAtualKg: 70, hoje: '2026-11-04', prazo: '2026-11-04' })).toBeNull();
  });
});
