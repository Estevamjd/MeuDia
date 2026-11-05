import { describe, expect, it } from 'vitest';
import { refeicaoInsertSchema } from '../dieta.validator';

describe('refeicaoInsertSchema: "sem valor" é null, nunca 0', () => {
  it('aceita item com kcal null (fora da TACO) e mantém null', () => {
    const r = refeicaoInsertSchema.parse({ tipo: 'jantar', items: [{ nome: 'Profit 28500', calorias: null, fonte: 'rotulo' }] });
    expect(r.items[0]!.calorias).toBeNull();
  });

  it('item antigo só com números segue válido', () => {
    expect(() => refeicaoInsertSchema.parse({ tipo: 'cafe', items: [{ nome: 'pão', calorias: 300, proteina: 9 }] })).not.toThrow();
  });

  it('recusa kcal negativa e nome vazio', () => {
    expect(() => refeicaoInsertSchema.parse({ tipo: 'cafe', items: [{ nome: 'pão', calorias: -1 }] })).toThrow();
    expect(() => refeicaoInsertSchema.parse({ tipo: 'cafe', items: [{ nome: '  ', calorias: 10 }] })).toThrow();
  });
});
