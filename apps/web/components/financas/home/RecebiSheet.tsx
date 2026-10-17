'use client';

import { useState } from 'react';
import type { Carteira } from '@meudia/shared';
import { Button, Modal } from '../../ui';
import { formatBRL } from '../../../lib/financas-ui';
import { SeletorCarteira } from '../SeletorCarteira';
import type { RendaAReceberItem } from './CardRendaAReceber';

export interface RecebiSheetProps {
  renda: RendaAReceberItem | null;
  carteiras: Pick<Carteira, 'id' | 'nome' | 'tipo'>[];
  carteiraPadrao: string | null;
  salvando: boolean;
  onClose: () => void;
  onConfirmar: (carteiraId: string | null) => void;
}

/** Confirma o "Recebi": em qual banco o salário caiu (padrão: o da renda ou o último usado). */
export function RecebiSheet({ renda, carteiras, carteiraPadrao, salvando, onClose, onConfirmar }: RecebiSheetProps) {
  return (
    <Modal isOpen={!!renda} onClose={onClose} title="Recebi o salário">
      {renda && <Form renda={renda} carteiras={carteiras} padrao={carteiraPadrao} salvando={salvando} onConfirmar={onConfirmar} />}
    </Modal>
  );
}

function Form({ renda, carteiras, padrao, salvando, onConfirmar }: {
  renda: RendaAReceberItem; carteiras: RecebiSheetProps['carteiras']; padrao: string | null; salvando: boolean; onConfirmar: (id: string | null) => void;
}) {
  const [carteira, setCarteira] = useState<string | null>(padrao);
  // Sempre uma carteira ativa quando existir: padrão fora da lista (ex.: arquivada) cai na primeira; sem nenhuma, null.
  const escolhida = carteiras.find((c) => c.id === carteira)?.id ?? carteiras[0]?.id ?? null;
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        onConfirmar(escolhida);
      }}
    >
      <p className="text-[15px] text-muted">
        {renda.descricao}: <span className="font-semibold tabular-nums text-text">{formatBRL(renda.valor)}</span>
      </p>
      {carteiras.length > 0 ? (
        <SeletorCarteira id="recebi-carteira" label="Caiu em" carteiras={carteiras} value={escolhida} onChange={setCarteira} />
      ) : (
        <p className="text-[13px] text-muted">Sem banco cadastrado, o salário entra na renda do mês, mas não em um saldo.</p>
      )}
      <Button type="submit" isLoading={salvando} className="min-h-[44px] w-full py-3 text-base">
        Confirmar {formatBRL(renda.valor)}
      </Button>
    </form>
  );
}
