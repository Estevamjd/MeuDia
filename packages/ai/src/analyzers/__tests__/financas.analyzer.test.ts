import { expect, it } from 'vitest';
import { analisarFinancasMes } from '../financas.analyzer';
it('ajustes não geram totais, categorias ou dicas de gasto', () => {
  const base = [{ tipo: 'receita' as const, valor: 100, categoria: 'Entrada', data: '2026-10-17' }];
  expect(analisarFinancasMes([...base,
    { ...base[0]!, valor: 800, ajuste: true },
    { ...base[0]!, tipo: 'despesa', valor: 900, ajuste: true },
  ])).toEqual(analisarFinancasMes(base));
});
