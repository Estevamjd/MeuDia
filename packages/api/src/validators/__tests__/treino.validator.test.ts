import { describe, it, expect } from 'vitest';
import {
  treinoInsertSchema,
  exercicioInsertSchema,
  serieRealizadaSchema,
  sessaoInsertSchema,
} from '../treino.validator';

const uuid = '550e8400-e29b-41d4-a716-446655440000';

describe('treinoInsertSchema', () => {
  it('should accept valid input with all fields', () => {
    const data = { nome: 'Treino A', dia_semana: 1, tipo: 'musculacao', observacao: 'obs', ordem: 0 };
    const result = treinoInsertSchema.parse(data);
    expect(result.nome).toBe('Treino A');
    expect(result.dia_semana).toBe(1);
    expect(result.tipo).toBe('musculacao');
  });

  it('should accept valid input with only required fields', () => {
    const result = treinoInsertSchema.parse({ nome: 'Treino B', dia_semana: 0 });
    expect(result.nome).toBe('Treino B');
    expect(result.dia_semana).toBe(0);
  });

  it('should fail when nome is missing', () => {
    const result = treinoInsertSchema.safeParse({ dia_semana: 1 });
    expect(result.success).toBe(false);
  });

  it('should fail when nome is empty string', () => {
    const result = treinoInsertSchema.safeParse({ nome: '', dia_semana: 1 });
    expect(result.success).toBe(false);
  });

  it('should fail when dia_semana is missing', () => {
    const result = treinoInsertSchema.safeParse({ nome: 'Treino' });
    expect(result.success).toBe(false);
  });

  it('should fail when dia_semana is below 0', () => {
    const result = treinoInsertSchema.safeParse({ nome: 'Treino', dia_semana: -1 });
    expect(result.success).toBe(false);
  });

  it('should fail when dia_semana is above 6', () => {
    const result = treinoInsertSchema.safeParse({ nome: 'Treino', dia_semana: 7 });
    expect(result.success).toBe(false);
  });

  it('should transform dia_semana to DiaSemana type (0-6)', () => {
    for (let i = 0; i <= 6; i++) {
      const result = treinoInsertSchema.parse({ nome: 'T', dia_semana: i });
      expect(result.dia_semana).toBe(i);
    }
  });

  it('should fail when nome is not a string', () => {
    const result = treinoInsertSchema.safeParse({ nome: 123, dia_semana: 1 });
    expect(result.success).toBe(false);
  });

  it('should fail when dia_semana is not a number', () => {
    const result = treinoInsertSchema.safeParse({ nome: 'Treino', dia_semana: 'segunda' });
    expect(result.success).toBe(false);
  });

  it('should accept nullable tipo', () => {
    const result = treinoInsertSchema.parse({ nome: 'T', dia_semana: 0, tipo: null });
    expect(result.tipo).toBeNull();
  });

  it('should fail when tipo is invalid enum value', () => {
    const result = treinoInsertSchema.safeParse({ nome: 'T', dia_semana: 0, tipo: 'yoga' });
    expect(result.success).toBe(false);
  });

  it('should accept all valid tipo enum values', () => {
    for (const tipo of ['musculacao', 'cardio', 'funcional', 'descanso']) {
      const result = treinoInsertSchema.parse({ nome: 'T', dia_semana: 0, tipo });
      expect(result.tipo).toBe(tipo);
    }
  });
});

describe('exercicioInsertSchema', () => {
  const validData = { treino_id: uuid, nome: 'Supino' };

  it('should accept valid input with only required fields and apply defaults', () => {
    const result = exercicioInsertSchema.parse(validData);
    expect(result.treino_id).toBe(uuid);
    expect(result.nome).toBe('Supino');
    expect(result.series).toBe(3);
    expect(result.repeticoes).toBe('10-12');
    expect(result.tempo_descanso).toBe(60);
  });

  it('should accept valid input with all fields', () => {
    const data = {
      treino_id: uuid,
      nome: 'Agachamento',
      series: 5,
      repeticoes: '8-10',
      carga: 80,
      tempo_descanso: 90,
      observacao: 'Foco na execução',
      ordem: 2,
    };
    const result = exercicioInsertSchema.parse(data);
    expect(result.series).toBe(5);
    expect(result.repeticoes).toBe('8-10');
    expect(result.tempo_descanso).toBe(90);
    expect(result.carga).toBe(80);
  });

  it('should fail when treino_id is missing', () => {
    const result = exercicioInsertSchema.safeParse({ nome: 'Supino' });
    expect(result.success).toBe(false);
  });

  it('should fail when treino_id is not a valid uuid', () => {
    const result = exercicioInsertSchema.safeParse({ treino_id: 'not-a-uuid', nome: 'Supino' });
    expect(result.success).toBe(false);
  });

  it('should fail when nome is missing', () => {
    const result = exercicioInsertSchema.safeParse({ treino_id: uuid });
    expect(result.success).toBe(false);
  });

  it('should fail when nome is empty string', () => {
    const result = exercicioInsertSchema.safeParse({ treino_id: uuid, nome: '' });
    expect(result.success).toBe(false);
  });

  it('should fail when series is less than 1', () => {
    const result = exercicioInsertSchema.safeParse({ treino_id: uuid, nome: 'X', series: 0 });
    expect(result.success).toBe(false);
  });

  it('should fail when tempo_descanso is negative', () => {
    const result = exercicioInsertSchema.safeParse({ treino_id: uuid, nome: 'X', tempo_descanso: -1 });
    expect(result.success).toBe(false);
  });

  it('should fail when carga is negative', () => {
    const result = exercicioInsertSchema.safeParse({ treino_id: uuid, nome: 'X', carga: -5 });
    expect(result.success).toBe(false);
  });

  it('should accept nullable carga', () => {
    const result = exercicioInsertSchema.parse({ treino_id: uuid, nome: 'X', carga: null });
    expect(result.carga).toBeNull();
  });

  it('should fail when nome is not a string', () => {
    const result = exercicioInsertSchema.safeParse({ treino_id: uuid, nome: 123 });
    expect(result.success).toBe(false);
  });
});

describe('serieRealizadaSchema', () => {
  const validData = { sessao_id: uuid, exercicio_id: uuid, numero_serie: 1 };

  it('should accept valid input with required fields and apply defaults', () => {
    const result = serieRealizadaSchema.parse(validData);
    expect(result.sessao_id).toBe(uuid);
    expect(result.exercicio_id).toBe(uuid);
    expect(result.numero_serie).toBe(1);
    expect(result.concluido).toBe(false);
  });

  it('should accept valid input with all fields', () => {
    const data = {
      sessao_id: uuid,
      exercicio_id: uuid,
      numero_serie: 3,
      carga_usada: 50,
      reps_feitas: 12,
      concluido: true,
    };
    const result = serieRealizadaSchema.parse(data);
    expect(result.carga_usada).toBe(50);
    expect(result.reps_feitas).toBe(12);
    expect(result.concluido).toBe(true);
  });

  it('should fail when sessao_id is missing', () => {
    const result = serieRealizadaSchema.safeParse({ exercicio_id: uuid, numero_serie: 1 });
    expect(result.success).toBe(false);
  });

  it('should fail when exercicio_id is missing', () => {
    const result = serieRealizadaSchema.safeParse({ sessao_id: uuid, numero_serie: 1 });
    expect(result.success).toBe(false);
  });

  it('should fail when numero_serie is missing', () => {
    const result = serieRealizadaSchema.safeParse({ sessao_id: uuid, exercicio_id: uuid });
    expect(result.success).toBe(false);
  });

  it('should fail when numero_serie is less than 1', () => {
    const result = serieRealizadaSchema.safeParse({ sessao_id: uuid, exercicio_id: uuid, numero_serie: 0 });
    expect(result.success).toBe(false);
  });

  it('should fail when sessao_id is not a valid uuid', () => {
    const result = serieRealizadaSchema.safeParse({ sessao_id: 'bad', exercicio_id: uuid, numero_serie: 1 });
    expect(result.success).toBe(false);
  });

  it('should fail when exercicio_id is not a valid uuid', () => {
    const result = serieRealizadaSchema.safeParse({ sessao_id: uuid, exercicio_id: 'bad', numero_serie: 1 });
    expect(result.success).toBe(false);
  });

  it('should default concluido to false', () => {
    const result = serieRealizadaSchema.parse(validData);
    expect(result.concluido).toBe(false);
  });

  it('should accept nullable carga_usada and reps_feitas', () => {
    const result = serieRealizadaSchema.parse({ ...validData, carga_usada: null, reps_feitas: null });
    expect(result.carga_usada).toBeNull();
    expect(result.reps_feitas).toBeNull();
  });

  it('should fail when carga_usada is negative', () => {
    const result = serieRealizadaSchema.safeParse({ ...validData, carga_usada: -1 });
    expect(result.success).toBe(false);
  });

  it('should fail when reps_feitas is negative', () => {
    const result = serieRealizadaSchema.safeParse({ ...validData, reps_feitas: -1 });
    expect(result.success).toBe(false);
  });
});

describe('sessaoInsertSchema', () => {
  it('should accept empty object and apply defaults', () => {
    const result = sessaoInsertSchema.parse({});
    expect(result.concluido).toBe(false);
  });

  it('should accept valid input with all fields', () => {
    const data = {
      treino_id: uuid,
      data: '2026-03-30',
      duracao_minutos: 45,
      concluido: true,
      observacao: 'Bom treino',
    };
    const result = sessaoInsertSchema.parse(data);
    expect(result.treino_id).toBe(uuid);
    expect(result.concluido).toBe(true);
    expect(result.duracao_minutos).toBe(45);
  });

  it('should default concluido to false', () => {
    const result = sessaoInsertSchema.parse({});
    expect(result.concluido).toBe(false);
  });

  it('should accept nullable treino_id', () => {
    const result = sessaoInsertSchema.parse({ treino_id: null });
    expect(result.treino_id).toBeNull();
  });

  it('should fail when treino_id is not a valid uuid', () => {
    const result = sessaoInsertSchema.safeParse({ treino_id: 'not-uuid' });
    expect(result.success).toBe(false);
  });

  it('should fail when duracao_minutos is negative', () => {
    const result = sessaoInsertSchema.safeParse({ duracao_minutos: -10 });
    expect(result.success).toBe(false);
  });

  it('should fail when concluido is not a boolean', () => {
    const result = sessaoInsertSchema.safeParse({ concluido: 'yes' });
    expect(result.success).toBe(false);
  });
});
