'use client';

import { Button, ConfirmDialog, Modal } from '../ui';
import type { EscolhaParcela } from './useExclusaoLancamento';

/** Texto fixo de toda exclusão em Finanças: nada some sem esta confirmação. */
export const TEXTO_EXCLUIR = 'Excluir? Isso não pode ser desfeito.';

/**
 * Renda: os "Recebi" dela caem em cascata (FK da 006); as receitas já lançadas ficam como receita comum, então o
 * saldo dos bancos não muda. Ela some da renda prevista e da sobra dos próximos meses.
 */
export function detalheExclusaoRenda(descricao: string): string {
  return `A renda "${descricao}" sai da sobra do mês. O que você já marcou como "Recebi" continua como receita lançada e o saldo dos bancos não muda.`;
}

export interface ConfirmarExclusaoProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  /** Título do diálogo (ex.: "Excluir lançamento"). */
  titulo: string;
  /** O que acontece além de sumir (ex.: "a conta volta a ficar a pagar"). */
  detalhe?: string;
  isLoading?: boolean;
  /** Parcela do cartão que não é a última: "Só esta parcela" ou "Esta e as próximas (k a N)" no lugar do Excluir. */
  parcela?: EscolhaParcela | null;
}

/** "Excluir? Isso não pode ser desfeito." + o efeito, com Cancelar / Excluir. */
export function ConfirmarExclusao({ isOpen, onClose, onConfirm, titulo, detalhe, isLoading, parcela }: ConfirmarExclusaoProps) {
  if (parcela) {
    // Botões empilhados, largura toda: os dois rótulos inteiros em 360px.
    return (
      <Modal isOpen={isOpen} onClose={onClose} title={titulo}>
        <p className="text-sm text-muted">{detalhe ? `${TEXTO_EXCLUIR} ${detalhe}` : TEXTO_EXCLUIR}</p>
        <div className="mt-5 flex flex-col gap-2">
          <Button variant="danger" onClick={parcela.onSoEsta} disabled={isLoading} className="min-h-[44px] w-full">
            Só esta parcela
          </Button>
          <Button variant="danger" onClick={parcela.onEstaEProximas} disabled={isLoading} className="min-h-[44px] w-full">
            Esta e as próximas ({parcela.num} a {parcela.total})
          </Button>
          <Button variant="ghost" onClick={onClose} disabled={isLoading} className="min-h-[44px] w-full">
            Cancelar
          </Button>
        </div>
      </Modal>
    );
  }
  return (
    <ConfirmDialog
      isOpen={isOpen}
      onClose={onClose}
      onConfirm={onConfirm}
      title={titulo}
      message={detalhe ? `${TEXTO_EXCLUIR} ${detalhe}` : TEXTO_EXCLUIR}
      confirmLabel="Excluir"
      isLoading={isLoading}
    />
  );
}
