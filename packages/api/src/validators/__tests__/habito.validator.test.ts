import { describe, it, expect } from 'vitest';
import { habitoInsertSchema, registroHabitoSchema } from '../habito.validator';

const uuid = '550e8400-e29b-41d4-a716-446655440000';

describe('habitoInsertSchema', () => {
  it('should accept valid input with only nome and apply all defaults', () => {
    const result = habitoInsertSchema.parse({ nome: 'Meditar' });
    expect(result.nome).toBe('Meditar');
    expect(result.icone).toBe('✅');
    expect(result.frequencia).toBe('diario');
    expect(result.dias_semana).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(result.meta).toBe(1);
  });

  it('should accept valid input with all fields', () => {
    const data = {
      nome: 'Exercitar',
      icone: '🏋️',
      frequencia: 'semanal' as const,
      dias_semana: [1, 3, 5],
      meta: 3,
      ordem: 1,
    };
    const result = habitoInsertSchema.parse(data);
    expect(result.nome).toBe('Exercitar');
    expect(result.icone).toBe('🏋️');
    expect(result.frequencia).toBe('semanal');
    expect(result.dias_semana).toEqual([1, 3, 5]);
    expect(result.meta).toBe(3);
    expect(result.ordem).toBe(1);
  });

  it('should fail when nome is missing', () => {
    const result = habitoInsertSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it('should fail when nome is empty string', () => {
    const result = habitoInsertSchema.safeParse({ nome: '' });
    expect(result.success).toBe(false);
  });

  it('should fail when nome is not a string', () => {
    const result = habitoInsertSchema.safeParse({ nome: 42 });
    expect(result.success).toBe(false);
  });

  it('should fail when frequencia is invalid enum value', () => {
    const result = habitoInsertSchema.safeParse({ nome: 'H', frequencia: 'mensal' });
    expect(result.success).toBe(false);
  });

  it('should accept frequencia diario', () => {
    const result = habitoInsertSchema.parse({ nome: 'H', frequencia: 'diario' });
    expect(result.frequencia).toBe('diario');
  });

  it('should accept frequencia semanal', () => {
    const result = habitoInsertSchema.parse({ nome: 'H', frequencia: 'semanal' });
    expect(result.frequencia).toBe('semanal');
  });

  it('should validate dias_semana values are in 0-6 range', () => {
    const result = habitoInsertSchema.safeParse({ nome: 'H', dias_semana: [7] });
    expect(result.success).toBe(false);
  });

  it('should fail when dias_semana contains negative values', () => {
    const result = habitoInsertSchema.safeParse({ nome: 'H', dias_semana: [-1] });
    expect(result.success).toBe(false);
  });

  it('should fail when dias_semana contains non-number values', () => {
    const result = habitoInsertSchema.safeParse({ nome: 'H', dias_semana: ['segunda'] });
    expect(result.success).toBe(false);
  });

  it('should accept empty dias_semana array', () => {
    const result = habitoInsertSchema.parse({ nome: 'H', dias_semana: [] });
    expect(result.dias_semana).toEqual([]);
  });

  it('should fail when meta is less than 1', () => {
    const result = habitoInsertSchema.safeParse({ nome: 'H', meta: 0 });
    expect(result.success).toBe(false);
  });

  it('should default meta to 1', () => {
    const result = habitoInsertSchema.parse({ nome: 'H' });
    expect(result.meta).toBe(1);
  });

  it('should default icone to check emoji', () => {
    const result = habitoInsertSchema.parse({ nome: 'H' });
    expect(result.icone).toBe('✅');
  });
});

describe('registroHabitoSchema', () => {
  it('should accept valid input with required fields and apply defaults', () => {
    const result = registroHabitoSchema.parse({ habito_id: uuid });
    expect(result.habito_id).toBe(uuid);
    expect(result.concluido).toBe(false);
    expect(result.valor).toBe(1);
  });

  it('should accept valid input with all fields', () => {
    const data = {
      habito_id: uuid,
      data: '2026-03-30',
      concluido: true,
      valor: 5,
    };
    const result = registroHabitoSchema.parse(data);
    expect(result.concluido).toBe(true);
    expect(result.valor).toBe(5);
    expect(result.data).toBe('2026-03-30');
  });

  it('should fail when habito_id is missing', () => {
    const result = registroHabitoSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it('should fail when habito_id is not a valid uuid', () => {
    const result = registroHabitoSchema.safeParse({ habito_id: 'not-a-uuid' });
    expect(result.success).toBe(false);
  });

  it('should fail when habito_id is an empty string', () => {
    const result = registroHabitoSchema.safeParse({ habito_id: '' });
    expect(result.success).toBe(false);
  });

  it('should default concluido to false', () => {
    const result = registroHabitoSchema.parse({ habito_id: uuid });
    expect(result.concluido).toBe(false);
  });

  it('should default valor to 1', () => {
    const result = registroHabitoSchema.parse({ habito_id: uuid });
    expect(result.valor).toBe(1);
  });

  it('should fail when valor is negative', () => {
    const result = registroHabitoSchema.safeParse({ habito_id: uuid, valor: -1 });
    expect(result.success).toBe(false);
  });

  it('should fail when concluido is not a boolean', () => {
    const result = registroHabitoSchema.safeParse({ habito_id: uuid, concluido: 'true' });
    expect(result.success).toBe(false);
  });

  it('should fail when habito_id is a number', () => {
    const result = registroHabitoSchema.safeParse({ habito_id: 123 });
    expect(result.success).toBe(false);
  });
});
