import { describe, expect, it } from 'vitest';
import { formatarWhatsapp, inicioSemana, normalizarWhatsapp, refeicaoPelaHora, resumoSemana } from '../registros';

describe('refeicaoPelaHora', () => {
  it.each([[7, 'cafe'], [12, 'almoco'], [16, 'lanche'], [20, 'jantar'], [23, 'ceia'], [2, 'cafe']] as const)('%sh → %s', (h, t) =>
    expect(refeicaoPelaHora(h)).toBe(t));
});

describe('resumoSemana', () => {
  // 2026-11-19 é quinta → semana começa 2026-11-16 (segunda).
  const hoje = '2026-11-19';
  it('semana vazia', () => {
    expect(inicioSemana(hoje)).toBe('2026-11-16');
    expect(resumoSemana([], hoje)).toEqual({ dias: [false, false, false, false, false, false, false], hoje: 3, diasAtivos: 0, minutos: 0, quantidade: 0, sequenciaSemanas: 0 });
  });

  it('dias, minutos e quantidade só da semana; futuro ignorado', () => {
    const r = resumoSemana(
      [
        { data: '2026-11-16', duracao_min: 40 },
        { data: '2026-11-16', duracao_min: 20 },
        { data: '2026-11-18', duracao_min: null },
        { data: '2026-11-12', duracao_min: 60 },
        { data: '2026-11-21', duracao_min: 30 },
      ],
      hoje,
    );
    expect(r.dias).toEqual([true, false, true, false, false, false, false]);
    expect(r).toMatchObject({ diasAtivos: 2, minutos: 60, quantidade: 3, sequenciaSemanas: 2 });
  });

  it('sequência conta a partir da semana passada se esta ainda não tem registro', () => {
    const r = resumoSemana([{ data: '2026-11-10' }, { data: '2026-11-03' }, { data: '2026-10-20' }], hoje);
    expect(r.sequenciaSemanas).toBe(2);
  });
});

describe('WhatsApp', () => {
  it('normaliza com ou sem DDI; vazio desliga; inválido = undefined', () => {
    expect(normalizarWhatsapp('(11) 98888-7777')).toBe('5511988887777');
    expect(normalizarWhatsapp('+55 11 98888-7777')).toBe('5511988887777');
    expect(normalizarWhatsapp('')).toBeNull();
    expect(normalizarWhatsapp('123')).toBeUndefined();
    expect(formatarWhatsapp('5511988887777')).toBe('+55 (11) 98888-7777');
    expect(formatarWhatsapp('14155550100')).toBe('+14155550100');
  });
});
