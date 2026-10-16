import type { QueryKey } from '@tanstack/react-query';
import type { Competencia } from '@meudia/shared';

export const contasKeys = {
  todas: ['contas-mes'] as const,
  mes: (userId: string | undefined, competencia: Competencia) =>
    ['contas-mes', userId, competencia] as const,
  contaTodas: ['conta-mes'] as const,
  conta: (userId: string | undefined, id: string) => ['conta-mes', userId, id] as const,
  contaDoMes: (userId: string | undefined, id: string, competencia: Competencia) =>
    ['conta-mes', userId, id, competencia] as const,
};

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
    ['transacoes'],
    ['transacoes-mes'],
    ['assinaturas'],
  ];
}
