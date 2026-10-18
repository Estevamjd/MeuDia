import { describe, expect, it } from 'vitest';
import { carteirasKeys, chavesAfetadasPorExclusaoDeRenda, chavesAfetadasPorLancamento, chavesAfetadasPorOrcamento, chavesAfetadasPorPagamento, contasKeys, orcamentoKeys } from '../financas-query-keys';

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
      ['carteiras'],
    ]);
  });
});

describe('chavesAfetadasPorExclusaoDeRenda', () => {
  it('excluir renda também invalida os vínculos (o "Recebi" da receita some em cascata; sem isso a receita segue marcada)', () => {
    expect(chavesAfetadasPorExclusaoDeRenda()).toEqual(expect.arrayContaining([...chavesAfetadasPorOrcamento(), ['vinculos-transacoes']]));
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
      ['vinculos-transacoes'],
      ['transacoes'],
      ['transacoes-mes'],
      ['assinaturas'],
      ['carteiras'],
    ]);
  });

  it('não invalida contas de outra competência', () => {
    const chaves = chavesAfetadasPorPagamento('u1', 'c1', '2026-10');
    expect(chaves).not.toContainEqual(['contas-mes', 'u1', '2026-11']);
    expect(chaves).not.toContainEqual(['contas-mes']);
  });
});

describe('carteirasKeys', () => {
  it('lista e painel ficam sob o prefixo invalidado por lançamentos', () => {
    expect(carteirasKeys.painel('u1', '2026-10-17')).toEqual(['carteiras', 'u1', 'painel', '2026-10-17']);
    expect(chavesAfetadasPorLancamento()).toContainEqual(carteirasKeys.lista('u1').slice(0, 1));
    expect(chavesAfetadasPorLancamento()).toContainEqual(['transacoes-mes']);
  });
});
