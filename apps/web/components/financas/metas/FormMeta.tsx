'use client';

import { useState } from 'react';
import { clsx } from 'clsx';
import type { IconeMeta as ChaveIconeMeta, MetaInsert } from '@meudia/shared';
import { ICONES_META } from '@meudia/shared';
import { Button, Input } from '../../ui';
import { mascaraBRL } from '../../../lib/financas-ui';
import { radioTeclado } from '../radioTeclado';
import { ICONES_LUCIDE_META, ROTULO_ICONE_META } from './IconeMeta';

export interface FormMetaProps {
  salvando: boolean;
  onSalvar: (meta: Required<Pick<MetaInsert, 'nome' | 'valor_alvo'>> & { data_limite: string | null; icone: ChaveIconeMeta | null }) => void;
}

/** Nova meta: nome, quanto custa, até quando (opcional) e ícone. */
export function FormMeta({ salvando, onSalvar }: FormMetaProps) {
  const [nome, setNome] = useState('');
  const [digitos, setDigitos] = useState('');
  const [data, setData] = useState('');
  const [icone, setIcone] = useState<ChaveIconeMeta | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const enviar = (e: React.FormEvent) => {
    e.preventDefault();
    const valor = mascaraBRL(digitos).valor;
    if (!nome.trim()) return setErro('Informe o nome (ex.: Videogame).');
    if (!(valor > 0)) return setErro('Informe quanto custa.');
    setErro(null);
    onSalvar({ nome: nome.trim(), valor_alvo: valor, data_limite: data || null, icone });
  };

  return (
    <form onSubmit={enviar} className="space-y-4" noValidate>
      <Input id="meta-nome" label="Nome" placeholder="Ex.: Videogame, Viagem" value={nome} onChange={(e) => setNome(e.target.value)} maxLength={80} required />
      <Input
        id="meta-valor"
        label="Quanto custa"
        type="text"
        inputMode="decimal"
        autoComplete="off"
        placeholder="R$ 0,00"
        value={mascaraBRL(digitos).exibicao}
        onChange={(e) => setDigitos(mascaraBRL(e.target.value).digitos)}
      />
      <Input id="meta-data" label="Até quando (opcional)" type="date" value={data} onChange={(e) => setData(e.target.value)} />
      <div className="flex flex-col gap-1.5">
        <span id="meta-icone-label" className="text-sm font-medium text-muted">Ícone</span>
        <div role="radiogroup" aria-labelledby="meta-icone-label" className="grid grid-cols-5 gap-2">
          {ICONES_META.map((chave, i) => {
            const Icone = ICONES_LUCIDE_META[chave];
            const ativo = icone === chave;
            return (
              <button
                key={chave}
                type="button"
                role="radio"
                aria-checked={ativo}
                aria-label={ROTULO_ICONE_META[chave]}
                tabIndex={(icone ? ativo : i === 0) ? 0 : -1}
                onKeyDown={(e) => radioTeclado(e, (j) => setIcone(ICONES_META[j]!))}
                onClick={() => setIcone(chave)}
                className={clsx(
                  'flex min-h-[44px] items-center justify-center rounded-xl border transition-colors',
                  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent',
                  ativo ? 'border-accent bg-accent/15 text-accent' : 'border-border bg-card2 text-muted',
                )}
              >
                <Icone size={20} aria-hidden="true" />
              </button>
            );
          })}
        </div>
      </div>
      {erro && <p role="alert" className="text-sm text-red">{erro}</p>}
      <Button type="submit" isLoading={salvando} className="w-full py-3 text-base">
        Salvar meta
      </Button>
    </form>
  );
}
