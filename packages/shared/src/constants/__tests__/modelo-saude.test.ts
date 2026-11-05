import { describe, expect, it } from 'vitest';
import { MODELO_TREINO_V1 } from '../modelo-saude';
import { formatarPrescricao } from '../../utils/repeticoes';

const prescricoes = (dia: number) =>
  MODELO_TREINO_V1.find((t) => t.dia_semana === dia)!.exercicios.map(
    (e) => `${e.nome} ${formatarPrescricao(e.series, { min: e.repeticoes_min, max: e.repeticoes_max })}`,
  );

describe('MODELO_TREINO_V1 (BRIEF §3.3)', () => {
  it('um treino por dia da semana, segunda a domingo', () => {
    expect(MODELO_TREINO_V1.map((t) => t.dia_semana).sort()).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });

  it('quarta é Recuperação, sem exercício; sábado e domingo são descanso', () => {
    for (const dia of [3, 6, 0]) {
      const t = MODELO_TREINO_V1.find((m) => m.dia_semana === dia)!;
      expect(t.tipo).toBe('descanso');
      expect(t.exercicios).toEqual([]);
    }
    expect(MODELO_TREINO_V1.find((t) => t.dia_semana === 3)!.nome).toBe('Recuperação');
  });

  it('segunda, Superior A, igual ao BRIEF', () => {
    expect(prescricoes(1)).toEqual([
      'Supino reto 3 × 8–12', 'Remada 3 × 8–12', 'Desenvolvimento 2 × 8–12',
      'Puxada alta 2 × 10–12', 'Rosca bíceps 2 × 10–15', 'Tríceps polia 2 × 10–15',
    ]);
  });

  it('terça, Inferior A: prancha em 3 séries sem repetição', () => {
    expect(prescricoes(2)).toEqual([
      'Agachamento 3 × 8–12', 'Leg press 2 × 10–12', 'Mesa flexora 3 × 10–12', 'Panturrilha 3 × 12–15', 'Prancha 3 séries',
    ]);
  });

  it('quinta (Superior B) e sexta (Inferior B)', () => {
    expect(prescricoes(4)).toEqual([
      'Puxada alta 3 × 8–12', 'Supino inclinado 3 × 8–12', 'Remada baixa 2 × 10–12',
      'Elevação lateral 2 × 12–15', 'Rosca martelo 2 × 10–15', 'Tríceps francês 2 × 10–15',
    ]);
    expect(prescricoes(5)).toEqual([
      'Levantamento romeno 3 × 8–10', 'Cadeira extensora 3 × 10–12', 'Agachamento guiado 2 × 10–12',
      'Cadeira flexora 2 × 10–12', 'Panturrilha 3 × 12–15',
    ]);
  });

  it('não inventa carga nem descanso', () => {
    for (const t of MODELO_TREINO_V1) for (const e of t.exercicios) expect(Object.keys(e).sort()).toEqual(['nome', 'repeticoes_max', 'repeticoes_min', 'series']);
  });
});

describe('MODELO_DIETA_V1 (BRIEF §3.4)', () => {
  it('6 refeições na ordem do dia, um tipo cada, só com nomes', async () => {
    const { MODELO_DIETA_V1 } = await import('../modelo-saude');
    expect(MODELO_DIETA_V1.map((r) => `${r.horario} ${r.nome}`)).toEqual([
      '07:00 Café da manhã', '10:00 Lanche', '12:30 Almoço', '17:00 Lanche da tarde', '20:30 Vitamina', '21:30 Jantar',
    ]);
    expect(new Set(MODELO_DIETA_V1.map((r) => r.tipo)).size).toBe(6);
    // Sem valor nutricional inventado: só strings.
    for (const r of MODELO_DIETA_V1) expect(r.itens.every((i) => typeof i === 'string')).toBe(true);
  });
});
