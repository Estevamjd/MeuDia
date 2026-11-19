'use client';

import { useState } from 'react';
import type { PerguntaFechamento } from '@meudia/shared';
import { Button, Input, Modal } from '../../ui';
import { formatBRL, mascaraBRL, nomeMes } from '../../../lib/financas-ui';

export interface FechamentoMesSheetProps {
  pergunta: PerguntaFechamento | null;
  aberto: boolean;
  salvando: boolean;
  onGuardar: (valor: number) => void;
  onAgoraNao: () => void;
  /** Fechar sem responder: pergunta de novo no próximo acesso. */
  onClose: () => void;
}

/** "Sobrou R$ X em <mês>. Quer guardar no Cofrinho?": valor editável; só "Guardar" mexe no Cofrinho. */
export function FechamentoMesSheet({ pergunta, aberto, salvando, onGuardar, onAgoraNao, onClose }: FechamentoMesSheetProps) {
  return (
    <Modal isOpen={aberto && !!pergunta} onClose={onClose} title="Fechamento do mês">
      {pergunta && <Form key={pergunta.competencia} pergunta={pergunta} salvando={salvando} onGuardar={onGuardar} onAgoraNao={onAgoraNao} />}
    </Modal>
  );
}

const digitosDe = (valor: number) => String(Math.round(valor * 100));

function Form({ pergunta, salvando, onGuardar, onAgoraNao }: Pick<FechamentoMesSheetProps, 'salvando' | 'onGuardar' | 'onAgoraNao'> & { pergunta: PerguntaFechamento }) {
  const [digitos, setDigitos] = useState(() => digitosDe(pergunta.valor));
  const { valor, exibicao } = mascaraBRL(digitos);
  return (
    <form
      className="space-y-4"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        if (valor > 0) onGuardar(valor);
      }}
    >
      <p className="text-[17px] text-text" data-testid="fechamento-pergunta">
        Sobrou <span className="font-semibold tabular-nums">{formatBRL(pergunta.valor)}</span> em {nomeMes(pergunta.competencia)}. Quer guardar no Cofrinho?
      </p>
      <Input
        id="fechamento-valor"
        label="Quanto guardar"
        type="text"
        inputMode="decimal"
        autoComplete="off"
        placeholder="R$ 0,00"
        value={exibicao}
        onChange={(e) => setDigitos(mascaraBRL(e.target.value).digitos)}
      />
      <p className="text-[13px] text-muted">Pode mudar o valor. O Cofrinho só aumenta se você tocar em Guardar.</p>
      <div className="grid grid-cols-2 gap-2">
        <Button type="button" variant="ghost" onClick={onAgoraNao} disabled={salvando} className="min-h-[44px] py-3 text-base">
          Agora não
        </Button>
        <Button type="submit" isLoading={salvando} disabled={!(valor > 0)} className="min-h-[44px] py-3 text-base">
          Guardar
        </Button>
      </div>
    </form>
  );
}
