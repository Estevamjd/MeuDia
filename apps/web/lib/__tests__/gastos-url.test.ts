import { describe, expect, it } from 'vitest';
import { filtrosGastos, hrefGastos } from '../gastos-url';

describe('filtros de Gastos na URL', () => {
  it('padrão: Últimas despesas do mês corrente, todas as categorias', () => {
    expect(filtrosGastos(new URLSearchParams(''), '2026-10-18')).toEqual({ aba: 'despesas', mes: '2026-10', categoria: null });
  });
  it('lê ?aba=analise&mes=2026-09&categoria=Mercado; mês inválido cai no corrente', () => {
    expect(filtrosGastos(new URLSearchParams('aba=analise&mes=2026-09&categoria=Mercado'), '2026-10-18'))
      .toEqual({ aba: 'analise', mes: '2026-09', categoria: 'Mercado' });
    expect(filtrosGastos(new URLSearchParams('mes=2026-13&aba=x'), '2026-10-18')).toEqual({ aba: 'despesas', mes: '2026-10', categoria: null });
  });
  it('monta a URL só com o que difere do padrão', () => {
    const atual = { aba: 'despesas' as const, mes: '2026-10', categoria: null };
    expect(hrefGastos(atual, {}, '2026-10-18')).toBe('/financas/gastos');
    expect(hrefGastos(atual, { categoria: 'Mercado' }, '2026-10-18')).toBe('/financas/gastos?categoria=Mercado');
    expect(hrefGastos(atual, { mes: '2026-09', aba: 'analise' }, '2026-10-18')).toBe('/financas/gastos?aba=analise&mes=2026-09');
  });
});
