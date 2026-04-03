import { describe, it, expect } from 'vitest';
import { listaInsertSchema, itemInsertSchema } from '../compras.validator';

const uuid = '550e8400-e29b-41d4-a716-446655440000';

describe('listaInsertSchema', () => {
  it('should accept empty object and apply default nome', () => {
    const result = listaInsertSchema.parse({});
    expect(result.nome).toBe('Lista de Compras');
  });

  it('should accept custom nome', () => {
    const result = listaInsertSchema.parse({ nome: 'Mercado' });
    expect(result.nome).toBe('Mercado');
  });

  it('should fail when nome is empty string', () => {
    const result = listaInsertSchema.safeParse({ nome: '' });
    expect(result.success).toBe(false);
  });

  it('should fail when nome is not a string', () => {
    const result = listaInsertSchema.safeParse({ nome: 123 });
    expect(result.success).toBe(false);
  });

  it('should default nome to Lista de Compras', () => {
    const result = listaInsertSchema.parse({});
    expect(result.nome).toBe('Lista de Compras');
  });
});

describe('itemInsertSchema', () => {
  const validData = { lista_id: uuid, nome: 'Arroz' };

  it('should accept valid input with required fields and apply defaults', () => {
    const result = itemInsertSchema.parse(validData);
    expect(result.lista_id).toBe(uuid);
    expect(result.nome).toBe('Arroz');
    expect(result.quantidade).toBe(1);
    expect(result.unidade).toBe('un');
  });

  it('should accept valid input with all fields', () => {
    const data = {
      lista_id: uuid,
      nome: 'Feijão',
      quantidade: 2,
      unidade: 'kg',
      categoria: 'Grãos',
      preco_estimado: 8.5,
    };
    const result = itemInsertSchema.parse(data);
    expect(result.quantidade).toBe(2);
    expect(result.unidade).toBe('kg');
    expect(result.categoria).toBe('Grãos');
    expect(result.preco_estimado).toBe(8.5);
  });

  it('should fail when lista_id is missing', () => {
    const result = itemInsertSchema.safeParse({ nome: 'Arroz' });
    expect(result.success).toBe(false);
  });

  it('should fail when lista_id is not a valid uuid', () => {
    const result = itemInsertSchema.safeParse({ lista_id: 'invalid', nome: 'Arroz' });
    expect(result.success).toBe(false);
  });

  it('should fail when nome is missing', () => {
    const result = itemInsertSchema.safeParse({ lista_id: uuid });
    expect(result.success).toBe(false);
  });

  it('should fail when nome is empty string', () => {
    const result = itemInsertSchema.safeParse({ lista_id: uuid, nome: '' });
    expect(result.success).toBe(false);
  });

  it('should default quantidade to 1', () => {
    const result = itemInsertSchema.parse(validData);
    expect(result.quantidade).toBe(1);
  });

  it('should default unidade to un', () => {
    const result = itemInsertSchema.parse(validData);
    expect(result.unidade).toBe('un');
  });

  it('should fail when quantidade is zero or less', () => {
    const result = itemInsertSchema.safeParse({ lista_id: uuid, nome: 'X', quantidade: 0 });
    expect(result.success).toBe(false);
  });

  it('should fail when quantidade is negative', () => {
    const result = itemInsertSchema.safeParse({ lista_id: uuid, nome: 'X', quantidade: -1 });
    expect(result.success).toBe(false);
  });

  it('should accept decimal quantidade', () => {
    const result = itemInsertSchema.parse({ lista_id: uuid, nome: 'X', quantidade: 0.5 });
    expect(result.quantidade).toBe(0.5);
  });

  it('should accept nullable categoria', () => {
    const result = itemInsertSchema.parse({ ...validData, categoria: null });
    expect(result.categoria).toBeNull();
  });

  it('should accept nullable preco_estimado', () => {
    const result = itemInsertSchema.parse({ ...validData, preco_estimado: null });
    expect(result.preco_estimado).toBeNull();
  });

  it('should fail when preco_estimado is negative', () => {
    const result = itemInsertSchema.safeParse({ ...validData, preco_estimado: -5 });
    expect(result.success).toBe(false);
  });

  it('should fail when lista_id is a number', () => {
    const result = itemInsertSchema.safeParse({ lista_id: 123, nome: 'X' });
    expect(result.success).toBe(false);
  });

  it('should fail when nome is not a string', () => {
    const result = itemInsertSchema.safeParse({ lista_id: uuid, nome: 42 });
    expect(result.success).toBe(false);
  });
});
