import { describe, expect, it } from 'vitest';
import { rendaPrincipal } from '../renda-principal';

const r = (id: string, descricao: string, created_at: string | null, ativo = true) =>
  ({ id, user_id: 'u', descricao, valor: 100, dia_recebimento: 5, ativo, created_at, updated_at: null });

describe('rendaPrincipal (dia do salário em Config)', () => {
  it('sem renda ativa → null', () => {
    expect(rendaPrincipal([])).toBeNull();
    expect(rendaPrincipal([r('a', 'Salário', '2026-01-01T00:00:00Z', false)])).toBeNull();
  });

  it('sem "Salário": a ativa mais antiga', () => {
    expect(rendaPrincipal([r('nova', 'Freela', '2026-05-01T00:00:00Z'), r('velha', 'Pensão', '2026-01-01T00:00:00Z')])?.id).toBe('velha');
  });

  it('a de categoria Salário ganha da mais antiga (nome sem acento/caixa e alias "Renda")', () => {
    const lista = [r('velha', 'Freela', '2026-01-01T00:00:00Z'), r('sal', 'salario', '2026-06-01T00:00:00Z')];
    expect(rendaPrincipal(lista)?.id).toBe('sal');
    expect(rendaPrincipal([r('velha', 'Freela', '2026-01-01T00:00:00Z'), r('renda', 'Renda', '2026-06-01T00:00:00Z')])?.id).toBe('renda');
  });

  it('duas de Salário: a mais antiga delas; inativa não conta; created_at nulo vai por último', () => {
    const lista = [
      r('sal-nova', 'Salário', '2026-06-01T00:00:00Z'),
      r('sal-inativa', 'Salário', '2025-01-01T00:00:00Z', false),
      r('sal-sem-data', 'Salário', null),
      r('sal-velha', 'Salário', '2026-02-01T00:00:00Z'),
    ];
    expect(rendaPrincipal(lista)?.id).toBe('sal-velha');
  });
});
