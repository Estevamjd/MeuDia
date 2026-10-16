'use client';

import type { Competencia } from '@meudia/shared';
import { useDesfazerPagamento, usePagarConta } from '../../hooks';
import { useToast } from '../ui';
import { isCompetenciaJaPaga, mensagemErroPagamento } from '../../lib/financas-ui';

interface Alvo {
  contaId: string;
  competencia: Competencia;
  descricao: string;
}

/** "Paguei" e "Desfazer" com toasts; 409 "já paga" vira aviso (o hook refaz a consulta). */
export function usePagamentoAcoes() {
  const toast = useToast();
  const pagar = usePagarConta();
  const desfazer = useDesfazerPagamento();

  const pagarConta = (alvo: Alvo, extra: { pago_em?: string; banco?: string | null } = {}) =>
    pagar.mutate(
      { contaId: alvo.contaId, competencia: alvo.competencia, ...extra },
      {
        onSuccess: () => toast.success(`"${alvo.descricao}" marcada como paga.`),
        onError: (error) =>
          isCompetenciaJaPaga(error)
            ? toast.info(mensagemErroPagamento(error))
            : toast.error(mensagemErroPagamento(error)),
      },
    );

  const desfazerPagamento = (alvo: Alvo) =>
    desfazer.mutate(
      { contaId: alvo.contaId, competencia: alvo.competencia },
      {
        onSuccess: () => toast.info(`Pagamento de "${alvo.descricao}" desfeito.`),
        onError: (error) => toast.error(mensagemErroPagamento(error)),
      },
    );

  return {
    pagarConta,
    desfazerPagamento,
    /** Conta com mutação em andamento (para spinner só no item certo). */
    contaOcupada: (pagar.isPending ? pagar.variables?.contaId : undefined) ??
      (desfazer.isPending ? desfazer.variables?.contaId : undefined),
  };
}
