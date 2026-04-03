import { describe, it, expect } from 'vitest';
import { veiculoInsertSchema, manutencaoInsertSchema } from '../veiculo.validator';

const uuid = '550e8400-e29b-41d4-a716-446655440000';

describe('veiculoInsertSchema', () => {
  it('should accept valid input with only required fields and apply defaults', () => {
    const result = veiculoInsertSchema.parse({ modelo: 'Civic' });
    expect(result.modelo).toBe('Civic');
    expect(result.km_atual).toBe(0);
  });

  it('should accept valid input with all fields', () => {
    const data = { modelo: 'Corolla', placa: 'ABC-1234', ano: 2023, km_atual: 15000 };
    const result = veiculoInsertSchema.parse(data);
    expect(result.modelo).toBe('Corolla');
    expect(result.placa).toBe('ABC-1234');
    expect(result.ano).toBe(2023);
    expect(result.km_atual).toBe(15000);
  });

  it('should fail when modelo is missing', () => {
    const result = veiculoInsertSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it('should fail when modelo is empty string', () => {
    const result = veiculoInsertSchema.safeParse({ modelo: '' });
    expect(result.success).toBe(false);
  });

  it('should fail when modelo is not a string', () => {
    const result = veiculoInsertSchema.safeParse({ modelo: 123 });
    expect(result.success).toBe(false);
  });

  it('should default km_atual to 0', () => {
    const result = veiculoInsertSchema.parse({ modelo: 'Civic' });
    expect(result.km_atual).toBe(0);
  });

  it('should fail when km_atual is negative', () => {
    const result = veiculoInsertSchema.safeParse({ modelo: 'Civic', km_atual: -100 });
    expect(result.success).toBe(false);
  });

  it('should fail when km_atual is not an integer', () => {
    const result = veiculoInsertSchema.safeParse({ modelo: 'Civic', km_atual: 15000.5 });
    expect(result.success).toBe(false);
  });

  it('should fail when ano is not an integer', () => {
    const result = veiculoInsertSchema.safeParse({ modelo: 'Civic', ano: 2023.5 });
    expect(result.success).toBe(false);
  });

  it('should accept optional placa', () => {
    const result = veiculoInsertSchema.parse({ modelo: 'Civic' });
    expect(result.placa).toBeUndefined();
  });

  it('should accept optional ano', () => {
    const result = veiculoInsertSchema.parse({ modelo: 'Civic' });
    expect(result.ano).toBeUndefined();
  });
});

describe('manutencaoInsertSchema', () => {
  const validData = {
    veiculo_id: uuid,
    tipo: 'Troca de óleo',
    data: '2026-03-30',
  };

  it('should accept valid input with required fields', () => {
    const result = manutencaoInsertSchema.parse(validData);
    expect(result.veiculo_id).toBe(uuid);
    expect(result.tipo).toBe('Troca de óleo');
    expect(result.data).toBe('2026-03-30');
  });

  it('should accept valid input with all fields', () => {
    const data = {
      ...validData,
      km_na_revisao: 15000,
      custo: 250.0,
      proxima_revisao_km: 25000,
      observacao: 'Óleo sintético',
    };
    const result = manutencaoInsertSchema.parse(data);
    expect(result.km_na_revisao).toBe(15000);
    expect(result.custo).toBe(250.0);
    expect(result.proxima_revisao_km).toBe(25000);
    expect(result.observacao).toBe('Óleo sintético');
  });

  it('should fail when veiculo_id is missing', () => {
    const result = manutencaoInsertSchema.safeParse({ tipo: 'Troca de óleo', data: '2026-03-30' });
    expect(result.success).toBe(false);
  });

  it('should fail when veiculo_id is not a valid uuid', () => {
    const result = manutencaoInsertSchema.safeParse({ veiculo_id: 'invalid', tipo: 'X', data: '2026-03-30' });
    expect(result.success).toBe(false);
  });

  it('should fail when tipo is missing', () => {
    const result = manutencaoInsertSchema.safeParse({ veiculo_id: uuid, data: '2026-03-30' });
    expect(result.success).toBe(false);
  });

  it('should fail when tipo is empty string', () => {
    const result = manutencaoInsertSchema.safeParse({ veiculo_id: uuid, tipo: '', data: '2026-03-30' });
    expect(result.success).toBe(false);
  });

  it('should fail when data is missing', () => {
    const result = manutencaoInsertSchema.safeParse({ veiculo_id: uuid, tipo: 'Troca de óleo' });
    expect(result.success).toBe(false);
  });

  it('should fail when data is empty string', () => {
    const result = manutencaoInsertSchema.safeParse({ veiculo_id: uuid, tipo: 'X', data: '' });
    expect(result.success).toBe(false);
  });

  it('should fail when km_na_revisao is not an integer', () => {
    const result = manutencaoInsertSchema.safeParse({ ...validData, km_na_revisao: 15000.5 });
    expect(result.success).toBe(false);
  });

  it('should fail when proxima_revisao_km is not an integer', () => {
    const result = manutencaoInsertSchema.safeParse({ ...validData, proxima_revisao_km: 25000.5 });
    expect(result.success).toBe(false);
  });

  it('should fail when veiculo_id is a number', () => {
    const result = manutencaoInsertSchema.safeParse({ veiculo_id: 123, tipo: 'X', data: '2026-03-30' });
    expect(result.success).toBe(false);
  });

  it('should accept optional km_na_revisao', () => {
    const result = manutencaoInsertSchema.parse(validData);
    expect(result.km_na_revisao).toBeUndefined();
  });

  it('should accept optional custo', () => {
    const result = manutencaoInsertSchema.parse(validData);
    expect(result.custo).toBeUndefined();
  });

  it('should accept optional observacao', () => {
    const result = manutencaoInsertSchema.parse(validData);
    expect(result.observacao).toBeUndefined();
  });
});
