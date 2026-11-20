'use client';

import { useState } from 'react';
import type { Transacao } from '@meudia/shared';
import { useDesfazerPagamento, useDesfazerRecebimento, useExcluirParcelasDesde, useExcluirTransacao, useVinculosTransacoes } from '../../hooks';
import { useToast } from '../ui';
import type { VinculoLancamento } from './LinhaLancamento';

/** O que a confirmação diz além de "Excluir? Isso não pode ser desfeito.". */
export function detalheExclusaoLancamento(
  t: Pick<Transacao, 'ajuste' | 'carteira_id'> & Partial<Pick<Transacao, 'parcela_grupo' | 'parcela_num' | 'parcela_total'>>,
  vinculo: VinculoLancamento | undefined,
): string {
  if (!vinculo && parcelaDe(t)) {
    const { num, total } = parcelaDe(t)!;
    return num < total
      ? `É a parcela ${num}/${total} de uma compra no cartão. Escolha o que sai.`
      : `É a última parcela (${num}/${total}) de uma compra no cartão. As outras ficam.`;
  }
  if (vinculo === 'pagamento') return 'Ele veio do "Paguei": o lançamento sai e a conta volta a ficar a pagar.';
  if (vinculo === 'recebimento') return 'Ele veio do "Recebi": o lançamento sai e a renda volta a ficar a receber.';
  if (t.ajuste) return 'É um ajuste de saldo: o saldo do banco volta ao que era antes da correção.';
  return t.carteira_id ? 'O lançamento sai e o saldo do banco volta ao que era.' : 'O lançamento sai do mês.';
}

/** Parcela do cartão (com grupo, número e total) ou `null` (compra à vista). */
export function parcelaDe(t: Partial<Pick<Transacao, 'parcela_grupo' | 'parcela_num' | 'parcela_total'>>): { grupo: string; num: number; total: number } | null {
  return t.parcela_grupo && t.parcela_num && t.parcela_total ? { grupo: t.parcela_grupo, num: t.parcela_num, total: t.parcela_total } : null;
}

/** Escolha da exclusão de uma parcela que não é a última: só ela, ou ela e as próximas (k a N). */
export interface EscolhaParcela {
  num: number;
  total: number;
  onSoEsta: () => void;
  onEstaEProximas: () => void;
}

/** Confirmação de exclusão de um lançamento; `null` = fechada. */
export interface ExclusaoLancamento {
  transacao: Transacao;
  detalhe: string;
  carregando: boolean;
  onConfirmar: () => void;
  onCancelar: () => void;
  /** Só em parcela que não é a última (e sem vínculo): troca o "Excluir" pelas duas opções. */
  parcela: EscolhaParcela | null;
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
  const excluirParcelas = useExcluirParcelasDesde();
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

  const parcela = excluindo && !mapa[excluindo.id] ? parcelaDe(excluindo) : null;
  const exclusao: ExclusaoLancamento | null = excluindo
    ? {
        transacao: excluindo,
        detalhe: detalheExclusaoLancamento(excluindo, mapa[excluindo.id]),
        carregando: excluirTransacao.isPending || excluirParcelas.isPending || desfazerRecebimento.isPending || desfazerPagamento.isPending,
        onConfirmar: () => confirmar(excluindo),
        onCancelar: () => setExcluindo(null),
        parcela:
          parcela && parcela.num < parcela.total
            ? {
                num: parcela.num,
                total: parcela.total,
                // Só esta = DELETE pelo id (as outras parcelas ficam como estão).
                onSoEsta: () => excluirTransacao.mutate(excluindo.id, aoExcluir(`Parcela ${parcela.num}/${parcela.total} excluída`)),
                onEstaEProximas: () =>
                  excluirParcelas.mutate(
                    { grupo: parcela.grupo, aPartirDe: parcela.num },
                    aoExcluir(`Parcelas ${parcela.num} a ${parcela.total} excluídas`),
                  ),
              }
            : null,
      }
    : null;

  return { vinculos: mapa, bloqueadas: !vinculos.isSuccess, pedirExclusao: setExcluindo, exclusao };
}
