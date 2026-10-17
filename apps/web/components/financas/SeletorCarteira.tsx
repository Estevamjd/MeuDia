'use client';

import { radioTeclado } from './radioTeclado';
import { clsx } from 'clsx';
import { Banknote, Landmark, PiggyBank } from 'lucide-react';
import type { Carteira, TipoCarteira } from '@meudia/shared';

const ICONE_TIPO: Record<TipoCarteira, typeof Landmark> = { banco: Landmark, dinheiro: Banknote, poupanca: PiggyBank };

export function IconeCarteira({ tipo, size = 16 }: { tipo: TipoCarteira; size?: number }) {
  const Icone = ICONE_TIPO[tipo] ?? Landmark;
  return <Icone size={size} aria-hidden="true" />;
}

interface SeletorCarteiraProps {
  carteiras: readonly Pick<Carteira, 'id' | 'nome' | 'tipo'>[];
  value: string | null;
  onChange: (id: string) => void;
  label: string;
  id: string;
  /** Desabilita uma opção (ex.: a origem no seletor de destino da transferência). */
  desabilitada?: string | null;
  /** Primeira opção "Sem carteira" (marcada quando `value` é null), para lançamentos antigos sem carteira. */
  onSemCarteira?: () => void;
}

const SEM_CARTEIRA = { id: null, nome: 'Sem carteira', tipo: null } as const;

/** Chips grandes (≥ 44px) para escolher o banco/carteira, em radiogroup. */
export function SeletorCarteira({ carteiras, value, onChange, label, id, desabilitada, onSemCarteira }: SeletorCarteiraProps) {
  const opcoes = onSemCarteira ? [SEM_CARTEIRA, ...carteiras] : carteiras;
  const habilitadas = opcoes.filter((c) => c.id !== desabilitada);
  const foco = habilitadas.some((c) => c.id === value) ? value : habilitadas[0]?.id;
  const escolher = (c: (typeof opcoes)[number]) => (c.id === null ? onSemCarteira?.() : onChange(c.id));
  return (
    <div className="flex flex-col gap-1.5">
      <span id={`${id}-label`} className="text-sm font-medium text-muted">
        {label}
      </span>
      <div role="radiogroup" aria-labelledby={`${id}-label`} className="flex flex-wrap gap-2">
        {opcoes.map((c) => {
          const ativo = value === c.id;
          const off = desabilitada === c.id;
          return (
            <button
              key={c.id ?? 'sem-carteira'}
              type="button"
              role="radio"
              aria-checked={ativo}
              disabled={off}
              tabIndex={c.id === foco ? 0 : -1}
              onKeyDown={(e) => radioTeclado(e, (i) => escolher(habilitadas[i]!))}
              onClick={() => escolher(c)}
              className={clsx(
                'inline-flex min-h-[44px] max-w-full items-center gap-2 rounded-full border px-4 text-sm transition-colors',
                'focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent disabled:opacity-40',
                ativo ? 'border-accent bg-accent/15 text-text' : 'border-border bg-card2 text-muted hover:border-accent/40',
              )}
            >
              {c.tipo && <IconeCarteira tipo={c.tipo} />}
              <span className="truncate">{c.nome}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
