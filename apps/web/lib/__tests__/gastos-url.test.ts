import { describe, expect, it } from 'vitest';
import { filtrosGastos, hrefGastos, type FiltrosGastos } from '../gastos-url';

const PADRAO = { busca: '', soWhatsapp: false };

describe('filtros de Gastos na URL', () => {
  it('padrão: Últimas despesas do mês corrente, todas as categorias, sem busca', () => {
    expect(filtrosGastos(new URLSearchParams(''), '2026-10-18')).toEqual({ aba: 'despesas', mes: '2026-10', categoria: null, ...PADRAO });
  });
  it('lê ?aba=analise&mes=2026-09&categoria=Mercado; mês inválido cai no corrente', () => {
    expect(filtrosGastos(new URLSearchParams('aba=analise&mes=2026-09&categoria=Mercado'), '2026-10-18'))
      .toEqual({ aba: 'analise', mes: '2026-09', categoria: 'Mercado', ...PADRAO });
    expect(filtrosGastos(new URLSearchParams('mes=2026-13&aba=x'), '2026-10-18')).toEqual({ aba: 'despesas', mes: '2026-10', categoria: null, ...PADRAO });
  });
  it('lê a busca (q=) como digitada e o "Só WhatsApp" (origem=whatsapp); outra origem não liga o filtro', () => {
    expect(filtrosGastos(new URLSearchParams('q=Pão%20de%20açúcar&origem=whatsapp'), '2026-10-18'))
      .toMatchObject({ busca: 'Pão de açúcar', soWhatsapp: true });
    expect(filtrosGastos(new URLSearchParams('origem=app'), '2026-10-18')).toMatchObject({ soWhatsapp: false });
  });
  it('monta a URL só com o que difere do padrão', () => {
    const atual: FiltrosGastos = { aba: 'despesas', mes: '2026-10', categoria: null, ...PADRAO };
    expect(hrefGastos(atual, {}, '2026-10-18')).toBe('/financas/gastos');
    expect(hrefGastos(atual, { categoria: 'Mercado' }, '2026-10-18')).toBe('/financas/gastos?categoria=Mercado');
    expect(hrefGastos(atual, { mes: '2026-09', aba: 'analise' }, '2026-10-18')).toBe('/financas/gastos?aba=analise&mes=2026-09');
    expect(hrefGastos(atual, { busca: '   ' }, '2026-10-18')).toBe('/financas/gastos');
    expect(hrefGastos(atual, { soWhatsapp: false }, '2026-10-18')).toBe('/financas/gastos');
  });
  it('ida e volta: o que a URL guarda é o que a tela lê (com acento e espaço)', () => {
    const atual: FiltrosGastos = { aba: 'despesas', mes: '2026-10', categoria: null, ...PADRAO };
    const href = hrefGastos(atual, { busca: 'pão de açúcar', soWhatsapp: true, mes: '2026-09', categoria: 'Mercado' }, '2026-10-18');
    expect(href).toBe('/financas/gastos?mes=2026-09&categoria=Mercado&q=p%C3%A3o+de+a%C3%A7%C3%BAcar&origem=whatsapp');
    const lido = filtrosGastos(new URL(href, 'http://x').searchParams, '2026-10-18');
    expect(lido).toEqual({ aba: 'despesas', mes: '2026-09', categoria: 'Mercado', busca: 'pão de açúcar', soWhatsapp: true });
    expect(hrefGastos(lido, { busca: '', soWhatsapp: false }, '2026-10-18')).toBe('/financas/gastos?mes=2026-09&categoria=Mercado');
  });
});
