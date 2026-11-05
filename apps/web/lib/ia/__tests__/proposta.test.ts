import { describe, expect, it } from 'vitest';
import { CATEGORIAS_IA, validarProposta } from '../proposta';

const ctx = {
  categorias: CATEGORIAS_IA,
  carteiras: [
    { id: '11111111-1111-4111-8111-111111111111', nome: 'Banco Teste' },
    { id: '22222222-2222-4222-8222-222222222222', nome: 'Carteira' },
  ],
  hojeISO: '2026-10-26',
};

describe('validarProposta (zod do card)', () => {
  it('"gastei 45 no mercado": R$45,00 / Mercado / hoje, sem carteira', () => {
    expect(validarProposta({ valor: 45, categoria: 'Mercado' }, ctx)).toEqual({
      valor: 45,
      categoria: 'Mercado',
      descricao: 'Mercado',
      data: '2026-10-26',
      carteira_id: null,
    });
  });

  it('categoria e carteira sem acento/caixa casam com a lista; valor arredonda a centavos', () => {
    const p = validarProposta({ valor: '12.345', categoria: 'combustivel', carteira: 'banco teste', data: '2026-10-20', descricao: 'Posto' }, ctx);
    expect(p).toEqual({ valor: 12.35, categoria: 'Combustível', descricao: 'Posto', data: '2026-10-20', carteira_id: ctx.carteiras[0]!.id });
  });

  it('carteira que não é do usuário vira null (não invalida o card)', () => {
    expect(validarProposta({ valor: 10, categoria: 'Lazer', carteira: 'Banco de Outra Pessoa' }, ctx)?.carteira_id).toBeNull();
  });

  it.each([
    ['valor zero', { valor: 0, categoria: 'Mercado' }],
    ['valor negativo', { valor: -5, categoria: 'Mercado' }],
    ['valor infinito', { valor: Infinity, categoria: 'Mercado' }],
    ['valor NaN', { valor: 'abc', categoria: 'Mercado' }],
    ['valor acima de DECIMAL(10,2)', { valor: 100_000_000, categoria: 'Mercado' }],
    ['valor que arredonda para zero', { valor: 0.001, categoria: 'Mercado' }],
    ['categoria fora da lista', { valor: 10, categoria: 'Cassino' }],
    ['categoria de sistema', { valor: 10, categoria: 'Ajuste de saldo' }],
    ['data inválida', { valor: 10, categoria: 'Mercado', data: '2026-02-30' }],
    ['data em outro formato', { valor: 10, categoria: 'Mercado', data: '26/10/2026' }],
    ['data futura', { valor: 10, categoria: 'Mercado', data: '2026-10-27' }],
    ['sem categoria', { valor: 10 }],
    ['nada', null],
  ])('inválido → null (fallback): %s', (_nome, args) => {
    expect(validarProposta(args, ctx)).toBeNull();
  });
});
