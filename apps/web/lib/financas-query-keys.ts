import type { QueryKey } from '@tanstack/react-query';
import type { Competencia } from '@meudia/shared';

export const contasKeys = {
  todas: ['contas-mes'] as const,
  mes: (userId: string | undefined, competencia: Competencia) =>
    ['contas-mes', userId, competencia] as const,
  /** Definições ativas (tela de contas); sob o prefixo `contas-mes` para herdar as invalidações. */
  definicoes: (userId: string | undefined) => ['contas-mes', userId, 'definicoes'] as const,
  contaTodas: ['conta-mes'] as const,
  conta: (userId: string | undefined, id: string) => ['conta-mes', userId, id] as const,
  contaDoMes: (userId: string | undefined, id: string, competencia: Competencia) =>
    ['conta-mes', userId, id, competencia] as const,
};

/** Resumo do mês (inclui o selo): prefixo igual ao de `ASSINATURA_INVALIDACOES`. */
export const resumoKeys = {
  todas: ['resumo-financeiro-mes'] as const,
  mes: (userId: string | undefined, ano: number, mes: number) =>
    ['resumo-financeiro-mes', userId, ano, mes] as const,
};

export const rendasKeys = {
  todas: ['rendas'] as const,
  lista: (userId: string | undefined) => ['rendas', userId] as const,
};

export const orcamentoKeys = {
  todas: ['orcamento-categorias'] as const,
  lista: (userId: string | undefined) => ['orcamento-categorias', userId] as const,
};

/** Bancos e carteira: lista e painel (saldo de hoje, previsões, "Recebi"). */
export const carteirasKeys = {
  todas: ['carteiras'] as const,
  lista: (userId: string | undefined) => ['carteiras', userId, 'lista'] as const,
  painel: (userId: string | undefined, hojeISO: string) => ['carteiras', userId, 'painel', hojeISO] as const,
};

/** Metas de compra (007). A sugestão usa a sobra do mês (painel + lançamentos), que tem as próprias chaves. */
export const metasKeys = {
  todas: ['metas'] as const,
  lista: (userId: string | undefined) => ['metas', userId] as const,
};

/** Rendas e orçamento mudam a sobra do mês, % comprometida e o selo; rendas também a previsão de saldo. */
export function chavesAfetadasPorOrcamento(): QueryKey[] {
  return [rendasKeys.todas, orcamentoKeys.todas, resumoKeys.todas, carteirasKeys.todas];
}

/** Excluir renda apaga os recebimentos em cascata: a receita do "Recebi" vira receita comum, então os vínculos mudam. */
export function chavesAfetadasPorExclusaoDeRenda(): QueryKey[] {
  return [...chavesAfetadasPorOrcamento(), ['vinculos-transacoes']];
}

/** Qualquer lançamento/transferência/recebimento muda saldo, previsão, resumo e listas do mês. */
export function chavesAfetadasPorLancamento(): QueryKey[] {
  return [['vinculos-transacoes'], ['transacoes'], ['transacoes-mes'], ['resumo-mensal'], resumoKeys.todas, carteirasKeys.todas];
}

/** Chaves afetadas ao pagar/desfazer uma conta numa competência. */
export function chavesAfetadasPorPagamento(
  userId: string | undefined,
  contaId: string,
  competencia: Competencia,
): QueryKey[] {
  return [
    contasKeys.mes(userId, competencia),
    // Inclui todas as competências da conta: o histórico de pagamentos muda.
    contasKeys.conta(userId, contaId),
    ['resumo-financeiro-mes'],
    ['resumo-mensal'],
    // A transação usa `pago_em`, que pode cair fora do mês da competência.
    ['vinculos-transacoes'],
    ['transacoes'],
    ['transacoes-mes'],
    ['assinaturas'],
    // Paguei com carteira muda o saldo e a previsão.
    carteirasKeys.todas,
  ];
}
