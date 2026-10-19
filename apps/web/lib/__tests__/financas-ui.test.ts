import { expect, it } from 'vitest';
import type { Competencia, OrcamentoCategoria, Transacao } from '@meudia/shared';
import {
  formatBRLSinal,
  linhasOrcamento,
  mascaraBRL,
  parseValorNaoNegativo,
  parseValorPositivo,
  partesCompetencia,
  referenciaMesAnterior,
  situacaoLimite,
  tagSobra,
  textoDelta,
  textoVencimento,
} from '../financas-ui';

it('mascaraBRL: dígitos viram centavos; ignora não dígitos e zeros à esquerda; limita 10 dígitos', () => {
  const m = mascaraBRL('480000');
  expect(m.valor).toBe(4800);
  expect(m.exibicao.replace(/\s/g, ' ')).toBe('R$ 4.800,00');
  expect(mascaraBRL('R$ 0,05')).toMatchObject({ digitos: '5', valor: 0.05 });
  expect(mascaraBRL('')).toEqual({ digitos: '', exibicao: '', valor: 0 });
  expect(mascaraBRL('000')).toEqual({ digitos: '', exibicao: '', valor: 0 });
  expect(mascaraBRL('12345678901234').valor).toBe(12345678.9);
});

it('tagSobra: zero é "zerada" (neutra), não "positiva"', () => {
  expect(tagSobra(0)).toEqual({ text: 'zerada', color: 'neutral' });
  expect(tagSobra(0.01)).toEqual({ text: 'positiva', color: 'teal' });
  expect(tagSobra(-10)).toEqual({ text: 'negativa', color: 'red' });
});

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

/** Intl usa NBSP entre "R$" e o número. */
const nbsp = (s: string) => s.replace(/\s/g, ' ');

it('textoDelta: null quando não mudou (a home oculta o comparativo)', () => {
  expect(textoDelta({ absoluto: 0, percentual: null })).toBeNull();
  expect(textoDelta({ absoluto: 0, percentual: 0 })).toBeNull();
});
it('textoDelta: "a mais"/"a menos" com referência do mês', () => {
  expect(nbsp(textoDelta({ absoluto: -120, percentual: -0.1 }, 'em setembro')!)).toBe('R$ 120,00 a menos que em setembro');
  expect(nbsp(textoDelta({ absoluto: 50.5, percentual: null })!)).toBe('R$ 50,50 a mais que no mês anterior');
});
it('referenciaMesAnterior vira o ano', () => {
  expect(referenciaMesAnterior('2026-10')).toBe('em setembro');
  expect(referenciaMesAnterior('2026-01')).toBe('em dezembro');
});
it('formatBRLSinal usa "−" (U+2212) no negativo', () => {
  expect(nbsp(formatBRLSinal(-10))).toBe('−R$ 10,00');
  expect(nbsp(formatBRLSinal(0))).toBe('R$ 0,00');
});
it.each([
  ['2026-10-16', 'vence hoje'],
  ['2026-10-17', 'vence amanhã'],
  ['2026-10-20', 'vence em 4 dias'],
  ['2026-10-15', 'venceu ontem'],
  ['2026-10-10', 'venceu há 6 dias'],
  ['2026-11-01', 'vence em 16 dias'],
])('textoVencimento(%s) com hoje 2026-10-16 = %s', (venc, esperado) => {
  expect(textoVencimento(venc, '2026-10-16')).toBe(esperado);
});
