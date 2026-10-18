'use client';

import { useState } from 'react';
import { clsx } from 'clsx';
import type { Meta } from '@meudia/shared';
import { Button, Input } from '../../ui';
import { formatBRL, mascaraBRL } from '../../../lib/financas-ui';

export interface FormGuardeiProps {
  meta: Meta;
  salvando: boolean;
  /** Soma ao guardado. */
  onGuardar: (valor: number) => void;
  /** Grava o total guardado (corrigir). */
  onCorrigir: (total: number) => void;
}

/** "Guardei": soma um valor; ou corrige o total guardado. Só registra: o dinheiro não sai de nenhum banco. */
export function FormGuardei({ meta, salvando, onGuardar, onCorrigir }: FormGuardeiProps) {
  const [modo, setModo] = useState<'somar' | 'corrigir'>('somar');
  const [digitos, setDigitos] = useState('');
  // Corrigir aceita R$ 0,00: "preenchido" separa campo vazio de zero digitado (a máscara tira os zeros).
  const [preenchido, setPreenchido] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const valor = mascaraBRL(digitos).valor;

  const enviar = (e: React.FormEvent) => {
    e.preventDefault();
    if (modo === 'somar') {
      if (!(valor > 0)) return setErro('Informe quanto guardou.');
      setErro(null);
      return onGuardar(valor);
    }
    if (!preenchido) return setErro('Informe o total guardado.');
    setErro(null);
    onCorrigir(valor);
  };

  const opcao = (m: typeof modo, rotulo: string) => (
    <button
      type="button"
      role="radio"
      aria-checked={modo === m}
      onClick={() => { setModo(m); setDigitos(''); setPreenchido(false); setErro(null); }}
      className={clsx('min-h-[44px] flex-1 rounded-lg border px-2 text-sm', modo === m ? 'border-accent bg-accent/15 text-text' : 'border-border bg-card2 text-muted')}
    >
      {rotulo}
    </button>
  );

  return (
    <form onSubmit={enviar} className="space-y-4" noValidate>
      <p className="text-[15px] text-muted">
        Em {meta.nome} você já guardou <span className="font-semibold tabular-nums text-text">{formatBRL(Number(meta.valor_guardado))}</span>.
      </p>
      <div role="radiogroup" aria-label="O que fazer" className="flex gap-2">
        {opcao('somar', 'Somar')}
        {opcao('corrigir', 'Corrigir o total guardado')}
      </div>
      <Input
        id="guardei-valor"
        label={modo === 'somar' ? 'Quanto guardou agora' : 'Total guardado'}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        placeholder="R$ 0,00"
        value={preenchido ? mascaraBRL(digitos).exibicao || formatBRL(0) : ''}
        onChange={(e) => {
          setPreenchido(/\d/.test(e.target.value));
          setDigitos(mascaraBRL(e.target.value).digitos);
        }}
      />
      <p className="text-[13px] text-muted">Só registra o que você separou; não tira dinheiro de nenhum banco.</p>
      {erro && <p role="alert" className="text-sm text-red">{erro}</p>}
      <Button type="submit" isLoading={salvando} className="w-full py-3 text-base">
        Salvar
      </Button>
    </form>
  );
}
