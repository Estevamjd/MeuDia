'use client';

import { useState } from 'react';
import type { Transacao } from '@meudia/shared';
import { useDesfazerPagamento, useDesfazerRecebimento, useExcluirTransacao, useVinculosTransacoes } from '../../hooks';
import { useToast } from '../ui';
import type { VinculoLancamento } from './LinhaLancamento';

/** O que a confirmação diz além de "Excluir? Isso não pode ser desfeito.". */
export function detalheExclusaoLancamento(t: Pick<Transacao, 'ajuste' | 'carteira_id'>, vinculo: VinculoLancamento | undefined): string {
  if (vinculo === 'pagamento') return 'Ele veio do "Paguei": o lançamento sai e a conta volta a ficar a pagar.';
  if (vinculo === 'recebimento') return 'Ele veio do "Recebi": o lançamento sai e a renda volta a ficar a receber.';
  if (t.ajuste) return 'É um ajuste de saldo: o saldo do banco volta ao que era antes da correção.';
  return t.carteira_id ? 'O lançamento sai e o saldo do banco volta ao que era.' : 'O lançamento sai do mês.';
}

/** Confirmação de exclusão de um lançamento; `null` = fechada. */
export interface ExclusaoLancamento {
  transacao: Transacao;
  detalhe: string;
  carregando: boolean;
  onConfirmar: () => void;
  onCancelar: () => void;
}

/**
 * Excluir lançamento (Gastos): sempre com `ConfirmarExclusao`; nada some antes de confirmar. Lançamento vinculado nunca
 * sai por DELETE (trg_vinculo_* da 006): excluir = desfazer o Recebi/Paguei.
 */
export function useExclusaoLancamento(transacaoIds: string[]) {
  const toast = useToast();
  const vinculos = useVinculosTransacoes(transacaoIds);
  const desfazerRecebimento = useDesfazerRecebimento();
  const desfazerPagamento = useDesfazerPagamento();
  const excluirTransacao = useExcluirTransacao();
  const [excluindo, setExcluindo] = useState<Transacao | null>(null);

  const mapa = Object.fromEntries([
    ...(vinculos.data?.recebimentos ?? []).filter((r) => r.transacao_id).map((r) => [r.transacao_id!, 'recebimento']),
    ...(vinculos.data?.pagamentos ?? []).filter((p) => p.transacao_id).map((p) => [p.transacao_id!, 'pagamento']),
  ]) as Record<string, VinculoLancamento>;

  const aoExcluir = (mensagem: string) => ({
    onSuccess: () => {
      void vinculos.refetch?.();
      toast.success(mensagem);
      setExcluindo(null);
    },
    onError: () => toast.error('Não foi possível excluir. Tente de novo.'),
  });
  const confirmar = (t: Transacao) => {
    const r = vinculos.data?.recebimentos.find((x) => x.transacao_id === t.id);
    if (r) return desfazerRecebimento.mutate({ rendaId: r.renda_id, competencia: r.competencia }, aoExcluir('Lançamento excluído. A renda voltou a ficar a receber.'));
    const p = vinculos.data?.pagamentos.find((x) => x.transacao_id === t.id);
    if (p) return desfazerPagamento.mutate({ contaId: p.conta_id, competencia: p.competencia }, aoExcluir('Lançamento excluído. A conta voltou a ficar a pagar.'));
    excluirTransacao.mutate(t.id, aoExcluir('Lançamento excluído'));
  };

  const exclusao: ExclusaoLancamento | null = excluindo
    ? {
        transacao: excluindo,
        detalhe: detalheExclusaoLancamento(excluindo, mapa[excluindo.id]),
        carregando: excluirTransacao.isPending || desfazerRecebimento.isPending || desfazerPagamento.isPending,
        onConfirmar: () => confirmar(excluindo),
        onCancelar: () => setExcluindo(null),
      }
    : null;

  return { vinculos: mapa, bloqueadas: !vinculos.isSuccess, pedirExclusao: setExcluindo, exclusao };
}
