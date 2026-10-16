import { describe, expect, it } from 'vitest';
import { chavesAfetadasPorOrcamento, chavesAfetadasPorPagamento, contasKeys, orcamentoKeys } from '../financas-query-keys';

describe('orcamentoKeys', () => {
  it('lista do orçamento fica sob o prefixo invalidado por chavesAfetadasPorOrcamento', () => {
    const lista = orcamentoKeys.lista('u1');
    expect(lista).toEqual(['orcamento-categorias', 'u1']);
    expect(chavesAfetadasPorOrcamento()).toContainEqual(lista.slice(0, 1));
  });

  it('salvar renda/limite invalida rendas, orçamento e o resumo (sobra e selo)', () => {
    expect(chavesAfetadasPorOrcamento()).toEqual([
      ['rendas'],
      ['orcamento-categorias'],
      ['resumo-financeiro-mes'],
    ]);
  });
});

describe('contasKeys', () => {
  it('inclui a competência nas chaves de contas do mês e da conta', () => {
    expect(contasKeys.mes('u1', '2026-10')).toEqual(['contas-mes', 'u1', '2026-10']);
    expect(contasKeys.contaDoMes('u1', 'c1', '2026-10')).toEqual(['conta-mes', 'u1', 'c1', '2026-10']);
  });

  it('competências diferentes geram chaves diferentes', () => {
    expect(contasKeys.mes('u1', '2026-10')).not.toEqual(contasKeys.mes('u1', '2026-11'));
  });

  it('chave da conta é prefixo da chave da conta no mês', () => {
    const prefixo = contasKeys.conta('u1', 'c1');
    expect(contasKeys.contaDoMes('u1', 'c1', '2026-10').slice(0, prefixo.length)).toEqual([...prefixo]);
  });
});

describe('chavesAfetadasPorPagamento', () => {
  it('invalida contas da competência, conta, resumo, transações e assinaturas', () => {
    expect(chavesAfetadasPorPagamento('u1', 'c1', '2026-10')).toEqual([
      ['contas-mes', 'u1', '2026-10'],
      ['conta-mes', 'u1', 'c1'],
      ['resumo-financeiro-mes'],
      ['resumo-mensal'],
      ['transacoes'],
      ['transacoes-mes'],
      ['assinaturas'],
    ]);
  });

  it('não invalida contas de outra competência', () => {
    const chaves = chavesAfetadasPorPagamento('u1', 'c1', '2026-10');
    expect(chaves).not.toContainEqual(['contas-mes', 'u1', '2026-11']);
    expect(chaves).not.toContainEqual(['contas-mes']);
  });
});
