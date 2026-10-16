'use client';

import { useState } from 'react';
import { Button, Input, Modal } from '../../ui';
import { mascaraBRL } from '../../../lib/financas-ui';

export interface RendaSheetProps {
  open: boolean;
  onClose: () => void;
  onSalvar: (valor: number, dia: number | null) => void;
  salvando?: boolean;
  erro?: string;
}

/** "Sua renda do mês" direto na home: só valor (máscara R$) e dia opcional. */
export function RendaSheet({ open, onClose, ...form }: RendaSheetProps) {
  return (
    <Modal isOpen={open} onClose={onClose} title="Sua renda do mês">
      {/* Montado a cada abertura: o formulário começa limpo. */}
      <RendaForm {...form} />
    </Modal>
  );
}

function RendaForm({ onSalvar, salvando = false, erro }: Omit<RendaSheetProps, 'open' | 'onClose'>) {
  const [digitos, setDigitos] = useState('');
  const [dia, setDia] = useState('');
  const [erros, setErros] = useState<{ valor?: string; dia?: string }>({});
  const { exibicao, valor } = mascaraBRL(digitos);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const diaRecebimento = dia.trim() ? Number(dia) : null;
    const novos: typeof erros = {};
    if (valor <= 0) novos.valor = 'Informe um valor maior que zero.';
    if (diaRecebimento !== null && (!Number.isInteger(diaRecebimento) || diaRecebimento < 1 || diaRecebimento > 31)) {
      novos.dia = 'O dia vai de 1 a 31.';
    }
    setErros(novos);
    if (novos.valor || novos.dia) return;
    onSalvar(valor, diaRecebimento);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      <Input
        id="renda-sheet-valor"
        label="Valor"
        type="text"
        inputMode="decimal"
        autoComplete="off"
        placeholder="R$ 0,00"
        value={exibicao}
        onChange={(e) => setDigitos(mascaraBRL(e.target.value).digitos)}
        error={erros.valor}
        aria-invalid={!!erros.valor}
        required
      />
      <Input
        id="renda-sheet-dia"
        label="Dia que recebe (opcional)"
        type="number"
        inputMode="numeric"
        min="1"
        max="31"
        placeholder="1 a 31"
        value={dia}
        onChange={(e) => setDia(e.target.value)}
        error={erros.dia}
        aria-invalid={!!erros.dia}
      />
      {erro && (
        <p role="alert" className="text-sm text-red">
          {erro}
        </p>
      )}
      <Button type="submit" className="w-full py-3 text-base" isLoading={salvando}>
        Salvar
      </Button>
    </form>
  );
}
