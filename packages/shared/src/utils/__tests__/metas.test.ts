import { describe, expect, it } from 'vitest';
import { ICONES_META, mesesAtePrazo, sugestaoMeta } from '../metas';

const HOJE = '2026-10-18';
/** NBSP do Intl → espaço comum, para comparar textos. */
const limpo = (s: string) => s.replace(/\u00a0/g, ' ');

describe('mesesAtePrazo: meses inteiros do mês corrente até o mês da data limite', () => {
  it('18/10/2026 → 31/01/2027 = 3 (nov, dez, jan)', () => {
    expect(mesesAtePrazo(HOJE, '2027-01-31')).toBe(3);
    expect(mesesAtePrazo(HOJE, '2027-01-01')).toBe(3);
  });
  it('mesmo mês = 0, mês passado = negativo, virada de ano', () => {
    expect(mesesAtePrazo(HOJE, '2026-10-31')).toBe(0);
    expect(mesesAtePrazo(HOJE, '2026-09-30')).toBe(-1);
    expect(mesesAtePrazo('2026-12-31', '2027-01-01')).toBe(1);
  });
});

describe('sugestaoMeta', () => {
  it('aceite: sobra 2.090, Videogame 3.000 até jan/2027, guardado 0 → R$ 1.000,00 por mês, compra em janeiro de 2027', () => {
    const s = sugestaoMeta({ hojeISO: HOJE, sobraMensal: 2090, valorAlvo: 3000, valorGuardado: 0, dataLimite: '2027-01-31' });
    expect(s).toMatchObject({ tipo: 'cabe', falta: 3000, mesesAtePrazo: 3, porMes: 1000 });
    expect(limpo(s.texto)).toBe('Guarde R$ 1.000,00 por mês e em janeiro de 2027 você compra');
  });

  it('não cabe na sobra: mostra o prazo guardando a sobra inteira e 50% dela', () => {
    // Falta 3.000 em 3 meses = 1.000/mês > sobra 600. Sobra inteira: 5 meses (mar/2027); metade (300): 10 meses (ago/2027).
    const s = sugestaoMeta({ hojeISO: HOJE, sobraMensal: 600, valorAlvo: 3000, valorGuardado: 0, dataLimite: '2027-01-31' });
    expect(s.tipo).toBe('nao_cabe');
    expect(s.porMes).toBe(1000);
    expect(s.sobraInteira).toEqual({ porMes: 600, meses: 5, competencia: '2027-03' });
    expect(s.metadeDaSobra).toEqual({ porMes: 300, meses: 10, competencia: '2027-08' });
    expect(limpo(s.texto)).toBe('R$ 1.000,00 por mês não cabe na sua sobra de R$ 600,00');
    expect(s.detalhes.map(limpo)).toEqual([
      'Guardando a sobra inteira (R$ 600,00 por mês): 5 meses, em março de 2027.',
      'Guardando metade da sobra (R$ 300,00 por mês): 10 meses, em agosto de 2027.',
    ]);
  });

  it('sem data: prazo guardando 50% da sobra', () => {
    // Falta 3.000 − 500 = 2.500; metade de 2.090 = 1.045 → 3 meses (2.500/1.045 = 2,39) → janeiro de 2027.
    const s = sugestaoMeta({ hojeISO: HOJE, sobraMensal: 2090, valorAlvo: 3000, valorGuardado: 500, dataLimite: null });
    expect(s).toMatchObject({ tipo: 'sem_data', falta: 2500, mesesAtePrazo: null, porMes: null });
    expect(s.metadeDaSobra).toEqual({ porMes: 1045, meses: 3, competencia: '2027-01' });
    expect(limpo(s.texto)).toBe('Guardando metade da sobra (R$ 1.045,00 por mês), em 3 meses (janeiro de 2027) você compra');
  });

  it('sobra ≤ 0: não dá para guardar', () => {
    for (const sobra of [0, -120]) {
      const s = sugestaoMeta({ hojeISO: HOJE, sobraMensal: sobra, valorAlvo: 3000, valorGuardado: 0, dataLimite: '2027-01-31' });
      expect(s.tipo).toBe('sem_sobra');
      expect(s.texto).toBe('Com a sobra atual não dá para guardar; revise despesas');
      expect(s.sobraInteira).toBeNull();
      expect(s.metadeDaSobra).toBeNull();
    }
    expect(sugestaoMeta({ hojeISO: HOJE, sobraMensal: 0, valorAlvo: 10, valorGuardado: 0, dataLimite: null }).tipo).toBe('sem_sobra');
  });

  it('meta concluída (guardado ≥ alvo): "Meta alcançada", mesmo sem sobra ou com prazo passado', () => {
    for (const guardado of [3000, 3500]) {
      const s = sugestaoMeta({ hojeISO: HOJE, sobraMensal: -5, valorAlvo: 3000, valorGuardado: guardado, dataLimite: '2026-01-01' });
      expect(s).toMatchObject({ tipo: 'alcancada', falta: 0, texto: 'Meta alcançada' });
    }
  });

  it('prazo neste mês = "prazo curto"; prazo já passado = "prazo passou"; ambos com o plano pela sobra', () => {
    const curto = sugestaoMeta({ hojeISO: HOJE, sobraMensal: 1000, valorAlvo: 1500, valorGuardado: 0, dataLimite: '2026-10-30' });
    expect(curto.tipo).toBe('prazo_curto');
    expect(limpo(curto.texto)).toBe('Prazo curto: a data é neste mês e faltam R$ 1.500,00');
    expect(curto.sobraInteira).toEqual({ porMes: 1000, meses: 2, competencia: '2026-12' });
    const passou = sugestaoMeta({ hojeISO: HOJE, sobraMensal: 1000, valorAlvo: 1500, valorGuardado: 0, dataLimite: '2026-08-01' });
    expect(passou.tipo).toBe('prazo_passou');
    expect(limpo(passou.texto)).toBe('O prazo passou e faltam R$ 1.500,00');
    expect(passou.metadeDaSobra).toEqual({ porMes: 500, meses: 3, competencia: '2027-01' });
  });

  it('por mês arredonda para cima em centavos; exatamente igual à sobra cabe', () => {
    // 100 / 3 = 33,333… → 33,34 (3 × 33,34 cobre os 100).
    const s = sugestaoMeta({ hojeISO: HOJE, sobraMensal: 33.34, valorAlvo: 100, valorGuardado: 0, dataLimite: '2027-01-15' });
    expect(s.porMes).toBe(33.34);
    expect(s.tipo).toBe('cabe');
    const nao = sugestaoMeta({ hojeISO: HOJE, sobraMensal: 33.33, valorAlvo: 100, valorGuardado: 0, dataLimite: '2027-01-15' });
    expect(nao.tipo).toBe('nao_cabe');
    // Centavos sem erro de ponto flutuante: 0,1 + 0,2 guardados de 0,3.
    expect(sugestaoMeta({ hojeISO: HOJE, sobraMensal: 10, valorAlvo: 0.3, valorGuardado: 0.1 + 0.2, dataLimite: null }).tipo).toBe('alcancada');
  });

  it('metade da sobra nunca passa da metade (arredonda para baixo em centavos)', () => {
    const s = sugestaoMeta({ hojeISO: HOJE, sobraMensal: 0.03, valorAlvo: 0.03, valorGuardado: 0, dataLimite: null });
    expect(s.metadeDaSobra).toEqual({ porMes: 0.01, meses: 3, competencia: '2027-01' });
  });

  it('ícones de meta seguem o formato aceito pelo banco (CHECK da 007)', () => {
    expect(ICONES_META.length).toBeGreaterThan(5);
    for (const i of ICONES_META) expect(i).toMatch(/^[a-z][a-z0-9-]{0,39}$/);
  });
});
