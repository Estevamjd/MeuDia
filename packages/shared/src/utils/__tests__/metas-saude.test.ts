import { describe, expect, it } from 'vitest';
import {
  calcularMetas,
  calcularProteinaG,
  calcularTmb,
  definirKcalManual,
  definirProteinaManual,
  errosRespostasSaude,
  lerFaixaProteina,
  proteinaGKgValida,
  recalcularMetas,
  usarKcalCalculada,
  type MetasSaude,
  type RespostasSaude,
} from '../metas-saude';
import { FATORES_ATIVIDADE, FATOR_GANHO } from '../../constants/saude';

const homem28: RespostasSaude = { idade: 28, sexo: 'masculino', alturaCm: 175, pesoKg: 70, nivel: 'moderado', objetivo: 'ganhar' };

describe('Mifflin-St Jeor (design-system B §5, PLANO-F1 §10.2)', () => {
  it('conta de exemplo do design-system: homem 28a 175cm 70kg → TMB 1.658,75', () => {
    expect(calcularTmb(homem28)).toBe(1658.75);
  });

  it('casos do PLANO §10.2: homem 30a 70kg 175cm = 1.648,75; mulher 25a 60kg 165cm = 1.345,25', () => {
    expect(calcularTmb({ sexo: 'masculino', pesoKg: 70, alturaCm: 175, idade: 30 })).toBe(1648.75);
    expect(calcularTmb({ sexo: 'feminino', pesoKg: 60, alturaCm: 165, idade: 25 })).toBe(1345.25);
  });

  it('fatores fechados pelo Estevam: 1,40 / 1,70 / 2,00 e ganho +10%', () => {
    expect(FATORES_ATIVIDADE).toEqual({ leve: 1.4, moderado: 1.7, intenso: 2.0 });
    expect(FATOR_GANHO).toBe(1.1);
  });

  it('exemplo completo: TMB 1.659 → moderado 2.820 → ganhar 3.102 kcal; proteína 126 g', () => {
    expect(calcularMetas(homem28)).toEqual({ tmb: 1659, gasto: 2820, kcal: 3102, proteinaG: 126 });
  });

  it('manter = gasto estimado, sem os 10%', () => {
    expect(calcularMetas({ ...homem28, objetivo: 'manter' }).kcal).toBe(2820);
  });

  it('leve e intenso usam o próprio fator', () => {
    expect(calcularMetas({ ...homem28, nivel: 'leve', objetivo: 'manter' }).kcal).toBe(Math.round(1659 * 1.4));
    expect(calcularMetas({ ...homem28, nivel: 'intenso', objetivo: 'manter' }).kcal).toBe(3318);
  });

  it('proteína 1,8 g/kg: 66,5 kg → 120 g (119,7 arredondado)', () => {
    expect(calcularProteinaG(66.5)).toBe(120);
  });

  it('g/kg aceito entre 1,4 e 2,2; 1,3 e 2,3 recusados', () => {
    expect(proteinaGKgValida(1.4)).toBe(true);
    expect(proteinaGKgValida(2.2)).toBe(true);
    expect(proteinaGKgValida(1.3)).toBe(false);
    expect(proteinaGKgValida(2.3)).toBe(false);
  });

  it('cadastro fora do intervalo aponta o campo', () => {
    expect(errosRespostasSaude(homem28)).toEqual({});
    expect(errosRespostasSaude({ ...homem28, idade: 9, alturaCm: 30 })).toEqual({
      idade: 'Idade entre 15 e 100 anos.',
      alturaCm: 'Altura entre 100 e 250 cm.',
    });
  });
});

describe('meta editada à mão não é sobrescrita (PLANO-F1 §10.5)', () => {
  const calc = calcularMetas(homem28);

  it('primeira vez: metas calculadas, origem "calculada"', () => {
    const m = recalcularMetas(null, calc);
    expect(m).toMatchObject({ kcal: 3102, kcalOrigem: 'calculada', proteinaMinG: 126, proteinaMaxG: 126, proteinaOrigem: 'calculada' });
  });

  it('origem manual + peso novo: meta vigente igual, calculada muda', () => {
    const manual = definirKcalManual(recalcularMetas(null, calc), 2950);
    const depois = recalcularMetas(manual, calcularMetas({ ...homem28, pesoKg: 72 }));
    expect(depois.kcal).toBe(2950);
    expect(depois.kcalOrigem).toBe('manual');
    expect(depois.kcalCalculada).toBeGreaterThan(3102);
  });

  it('proteína manual (faixa 120–140) segue depois do recálculo', () => {
    const base = recalcularMetas(null, calc);
    const manual = definirProteinaManual(base, { min: 120, max: 140 }, 70) as MetasSaude;
    expect(manual.proteinaOrigem).toBe('manual');
    const depois = recalcularMetas(manual, calcularMetas({ ...homem28, pesoKg: 75 }));
    expect([depois.proteinaMinG, depois.proteinaMaxG]).toEqual([120, 140]);
    expect(depois.proteinaCalculadaG).toBe(135);
  });

  it('proteína fora de 1,4–2,2 g/kg é recusada com a faixa em gramas', () => {
    const base = recalcularMetas(null, calc);
    expect(definirProteinaManual(base, { min: 90, max: 90 }, 70)).toBe('Para 70,0 kg, fica entre 98 e 154 g (1,4 a 2,2 g/kg).');
    expect(definirProteinaManual(base, { min: 120, max: 160 }, 70)).toMatch(/entre 98 e 154 g/);
  });

  it('"usar a calculada" volta a origem', () => {
    const manual = definirKcalManual(recalcularMetas(null, calc), 2950);
    expect(usarKcalCalculada(manual)).toMatchObject({ kcal: 3102, kcalOrigem: 'calculada' });
  });

  it('lê "126", "120-140" e "120–140"; recusa max < min e texto', () => {
    expect(lerFaixaProteina('126')).toEqual({ min: 126, max: 126 });
    expect(lerFaixaProteina('120-140')).toEqual({ min: 120, max: 140 });
    expect(lerFaixaProteina('120 – 140')).toEqual({ min: 120, max: 140 });
    expect(lerFaixaProteina('140-120')).toBeNull();
    expect(lerFaixaProteina('muito')).toBeNull();
  });
});
