'use client';

import { ConfirmDialog } from '../ui';

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
}

/** "Excluir? Isso não pode ser desfeito." + o efeito, com Cancelar / Excluir. */
export function ConfirmarExclusao({ isOpen, onClose, onConfirm, titulo, detalhe, isLoading }: ConfirmarExclusaoProps) {
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
