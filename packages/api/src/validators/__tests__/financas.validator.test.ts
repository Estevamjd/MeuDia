import { describe, it, expect } from 'vitest';
import { transacaoInsertSchema } from '../financas.validator';

describe('transacaoInsertSchema', () => {
  const validData = {
    tipo: 'receita' as const,
    categoria: 'Salário',
    descricao: 'Salário mensal',
    valor: 5000,
  };

  it('should accept valid input with required fields', () => {
    const result = transacaoInsertSchema.parse(validData);
    expect(result.tipo).toBe('receita');
    expect(result.categoria).toBe('Salário');
    expect(result.descricao).toBe('Salário mensal');
    expect(result.valor).toBe(5000);
  });

  it('should accept valid input with all fields', () => {
    const data = { ...validData, data: '2026-03-30', banco: 'Nubank' };
    const result = transacaoInsertSchema.parse(data);
    expect(result.data).toBe('2026-03-30');
    expect(result.banco).toBe('Nubank');
  });

  it('should accept tipo receita', () => {
    const result = transacaoInsertSchema.parse(validData);
    expect(result.tipo).toBe('receita');
  });

  it('should accept tipo despesa', () => {
    const result = transacaoInsertSchema.parse({ ...validData, tipo: 'despesa' });
    expect(result.tipo).toBe('despesa');
  });

  it('should fail when tipo is invalid', () => {
    const result = transacaoInsertSchema.safeParse({ ...validData, tipo: 'transferencia' });
    expect(result.success).toBe(false);
  });

  it('should fail when tipo is missing', () => {
    const { tipo, ...rest } = validData;
    const result = transacaoInsertSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it('should fail when categoria is missing', () => {
    const { categoria, ...rest } = validData;
    const result = transacaoInsertSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it('should fail when categoria is empty string', () => {
    const result = transacaoInsertSchema.safeParse({ ...validData, categoria: '' });
    expect(result.success).toBe(false);
  });

  it('should fail when descricao is missing', () => {
    const { descricao, ...rest } = validData;
    const result = transacaoInsertSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it('should fail when descricao is empty string', () => {
    const result = transacaoInsertSchema.safeParse({ ...validData, descricao: '' });
    expect(result.success).toBe(false);
  });

  it('should fail when valor is missing', () => {
    const { valor, ...rest } = validData;
    const result = transacaoInsertSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it('should fail when valor is zero', () => {
    const result = transacaoInsertSchema.safeParse({ ...validData, valor: 0 });
    expect(result.success).toBe(false);
  });

  it('should fail when valor is negative', () => {
    const result = transacaoInsertSchema.safeParse({ ...validData, valor: -100 });
    expect(result.success).toBe(false);
  });

  it('should accept decimal valor', () => {
    const result = transacaoInsertSchema.parse({ ...validData, valor: 99.99 });
    expect(result.valor).toBe(99.99);
  });

  it('should fail when valor is not a number', () => {
    const result = transacaoInsertSchema.safeParse({ ...validData, valor: '5000' });
    expect(result.success).toBe(false);
  });

  it('should fail when tipo is not a string', () => {
    const result = transacaoInsertSchema.safeParse({ ...validData, tipo: 1 });
    expect(result.success).toBe(false);
  });
});
