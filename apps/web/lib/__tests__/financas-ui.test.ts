import { expect, it } from 'vitest';
import type { Competencia, OrcamentoCategoria, Transacao } from '@meudia/shared';
import { linhasOrcamento, parseValorNaoNegativo, parseValorPositivo, partesCompetencia, situacaoLimite } from '../financas-ui';

it('separa ano e mês válidos', () => {
  expect(partesCompetencia('2026-10')).toEqual({ ano: 2026, mes: 10 });
});
it.each(['2026', '2026-00', '2026-13', 'abc-10', '2026-1.5', '-1-10'])('rejeita ano/mês inválidos: %s', valor => {
  expect(() => partesCompetencia(valor as Competencia)).toThrow('Competência inválida');
});

const limite = (categoria: string, valor_planejado: number): OrcamentoCategoria => ({
  id: `o-${categoria}`, user_id: 'u1', categoria, valor_planejado, created_at: null, updated_at: null,
});
const transacao = (categoria: string, valor: number, tipo: Transacao['tipo'] = 'despesa'): Transacao => ({
  id: `t-${categoria}-${valor}`, user_id: 'u1', tipo, categoria, descricao: 'fixture', valor,
  data: '2026-10-05', banco: null, automatico: false, created_at: '2026-10-05T12:00:00Z',
});

it.each([
  [0, 100, 'dentro'],
  [79.99, 100, 'dentro'],
  [80, 100, 'perto'],
  [100, 100, 'perto'],
  [100.01, 100, 'acima'],
  [0, 0, 'dentro'],
  [1, 0, 'acima'],
] as const)('situacaoLimite(gasto=%s, limite=%s) = %s', (gasto, lim, esperado) => {
  expect(situacaoLimite(gasto, lim)).toBe(esperado);
});

it('linhasOrcamento soma só despesas da mesma categoria e calcula limite × gasto', () => {
  const linhas = linhasOrcamento(
    [limite('Mercado', 500), limite('Lazer', 200)],
    [transacao('Mercado', 300.1), transacao('Mercado', 100.2), transacao('Mercado', 999, 'receita'), transacao('Lazer', 50)],
  );
  expect(linhas.map((l) => [l.categoria, l.limite, l.gasto, l.situacao])).toEqual([
    ['Mercado', 500, 400.3, 'perto'],
    ['Lazer', 200, 50, 'dentro'],
  ]);
  expect(linhas[0]!.pct).toBeCloseTo(0.8006);
});

it('linhasOrcamento: mais comprometidas primeiro; categorias sem limite no fim, por gasto', () => {
  const linhas = linhasOrcamento(
    [limite('A', 100), limite('B', 100), limite('C', 100)],
    [transacao('B', 150), transacao('C', 50), transacao('Farmácia', 20), transacao('Uber', 80)],
  );
  expect(linhas.map((l) => l.categoria)).toEqual(['B', 'C', 'A', 'Uber', 'Farmácia']);
  expect(linhas[3]).toMatchObject({ orcamento: null, limite: null, gasto: 80, pct: null, situacao: null });
});

it('linhasOrcamento sem limite e sem gasto = vazio; match de categoria é exato (como o resumo)', () => {
  expect(linhasOrcamento([], [])).toEqual([]);
  const linhas = linhasOrcamento([limite('Mercado', 100)], [transacao('mercado', 30)]);
  expect(linhas.map((l) => [l.categoria, l.gasto])).toEqual([['Mercado', 0], ['mercado', 30]]);
});

it.each([
  ['10', 10],
  ['10,5', 10.5],
  ['0.019', 0.02],
  ['99999999.99', 99999999.99],
  ['', null],
  ['  ', null],
  ['0', null],
  ['0.001', null],
  ['-5', null],
  ['abc', null],
  ['100000000', null],
] as const)('parseValorPositivo(%j) = %s', (texto, esperado) => {
  expect(parseValorPositivo(texto)).toBe(esperado);
});

it.each([
  ['0', 0],
  ['0,00', 0],
  ['-0', 0],
  ['0.001', 0],
  ['10,5', 10.5],
  ['99999999.99', 99999999.99],
  ['', null],
  ['-0.01', null],
  ['abc', null],
  ['100000000', null],
] as const)('parseValorNaoNegativo(%j) = %s (limite de orçamento aceita 0)', (texto, esperado) => {
  expect(parseValorNaoNegativo(texto)).toBe(esperado);
});
