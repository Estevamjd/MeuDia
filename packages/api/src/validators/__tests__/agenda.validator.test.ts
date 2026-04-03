import { describe, it, expect } from 'vitest';
import { compromissoInsertSchema } from '../agenda.validator';

describe('compromissoInsertSchema', () => {
  const validData = {
    titulo: 'Reunião de trabalho',
    data_inicio: '2026-03-30T10:00:00',
  };

  it('should accept valid input with required fields and apply defaults', () => {
    const result = compromissoInsertSchema.parse(validData);
    expect(result.titulo).toBe('Reunião de trabalho');
    expect(result.data_inicio).toBe('2026-03-30T10:00:00');
    expect(result.prioridade).toBe('media');
    expect(result.tipo).toBe('geral');
    expect(result.concluido).toBe(false);
  });

  it('should accept valid input with all fields', () => {
    const data = {
      titulo: 'Consulta médica',
      descricao: 'Checkup anual',
      data_inicio: '2026-04-01T09:00:00',
      data_fim: '2026-04-01T10:00:00',
      local: 'Hospital',
      tipo: 'saude',
      prioridade: 'alta' as const,
      concluido: true,
    };
    const result = compromissoInsertSchema.parse(data);
    expect(result.descricao).toBe('Checkup anual');
    expect(result.data_fim).toBe('2026-04-01T10:00:00');
    expect(result.local).toBe('Hospital');
    expect(result.tipo).toBe('saude');
    expect(result.prioridade).toBe('alta');
    expect(result.concluido).toBe(true);
  });

  it('should fail when titulo is missing', () => {
    const result = compromissoInsertSchema.safeParse({ data_inicio: '2026-03-30T10:00:00' });
    expect(result.success).toBe(false);
  });

  it('should fail when titulo is empty string', () => {
    const result = compromissoInsertSchema.safeParse({ titulo: '', data_inicio: '2026-03-30T10:00:00' });
    expect(result.success).toBe(false);
  });

  it('should fail when data_inicio is missing', () => {
    const result = compromissoInsertSchema.safeParse({ titulo: 'Reunião' });
    expect(result.success).toBe(false);
  });

  it('should fail when data_inicio is empty string', () => {
    const result = compromissoInsertSchema.safeParse({ titulo: 'Reunião', data_inicio: '' });
    expect(result.success).toBe(false);
  });

  it('should default prioridade to media', () => {
    const result = compromissoInsertSchema.parse(validData);
    expect(result.prioridade).toBe('media');
  });

  it('should accept prioridade baixa', () => {
    const result = compromissoInsertSchema.parse({ ...validData, prioridade: 'baixa' });
    expect(result.prioridade).toBe('baixa');
  });

  it('should accept prioridade alta', () => {
    const result = compromissoInsertSchema.parse({ ...validData, prioridade: 'alta' });
    expect(result.prioridade).toBe('alta');
  });

  it('should accept prioridade urgente', () => {
    const result = compromissoInsertSchema.parse({ ...validData, prioridade: 'urgente' });
    expect(result.prioridade).toBe('urgente');
  });

  it('should fail when prioridade is invalid enum value', () => {
    const result = compromissoInsertSchema.safeParse({ ...validData, prioridade: 'critica' });
    expect(result.success).toBe(false);
  });

  it('should default tipo to geral', () => {
    const result = compromissoInsertSchema.parse(validData);
    expect(result.tipo).toBe('geral');
  });

  it('should default concluido to false', () => {
    const result = compromissoInsertSchema.parse(validData);
    expect(result.concluido).toBe(false);
  });

  it('should accept nullable descricao', () => {
    const result = compromissoInsertSchema.parse({ ...validData, descricao: null });
    expect(result.descricao).toBeNull();
  });

  it('should accept nullable data_fim', () => {
    const result = compromissoInsertSchema.parse({ ...validData, data_fim: null });
    expect(result.data_fim).toBeNull();
  });

  it('should accept nullable local', () => {
    const result = compromissoInsertSchema.parse({ ...validData, local: null });
    expect(result.local).toBeNull();
  });

  it('should fail when titulo is not a string', () => {
    const result = compromissoInsertSchema.safeParse({ titulo: 123, data_inicio: '2026-03-30' });
    expect(result.success).toBe(false);
  });

  it('should fail when concluido is not a boolean', () => {
    const result = compromissoInsertSchema.safeParse({ ...validData, concluido: 'false' });
    expect(result.success).toBe(false);
  });
});
