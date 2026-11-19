'use client';

import type { ReactNode } from 'react';
import { clsx } from 'clsx';
import { Monitor, Moon, Sun } from 'lucide-react';
import { useTema } from '../../hooks/useTema';
import type { PreferenciaTema } from '../../lib/tema';

const OPCOES: { valor: PreferenciaTema; rotulo: string; icone: ReactNode }[] = [
  { valor: 'claro', rotulo: 'Claro', icone: <Sun size={16} aria-hidden="true" /> },
  { valor: 'escuro', rotulo: 'Escuro', icone: <Moon size={16} aria-hidden="true" /> },
  { valor: 'sistema', rotulo: 'Sistema', icone: <Monitor size={16} aria-hidden="true" /> },
];

/** Configurações › Aparência: Claro / Escuro / Sistema (igual ao celular). Vale na hora e fica salvo. */
export function AparenciaTema() {
  const { preferencia, escolher } = useTema();
  return (
    <section aria-labelledby="config-aparencia" data-secao="aparencia" className="space-y-2">
      <h2 id="config-aparencia" className="px-1 text-xs font-semibold uppercase tracking-wider text-muted">
        Aparência
      </h2>
      <div className="rounded-card border border-border bg-card p-3">
        <div role="radiogroup" aria-labelledby="config-aparencia" className="grid grid-cols-3 gap-1 rounded-xl bg-card2 p-1">
          {OPCOES.map((o) => {
            const ativo = preferencia === o.valor;
            return (
              <button
                key={o.valor}
                type="button"
                role="radio"
                aria-checked={ativo}
                onClick={() => escolher(o.valor)}
                className={clsx(
                  'flex min-h-[44px] items-center justify-center gap-1.5 rounded-lg text-sm font-medium transition-colors',
                  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent',
                  ativo ? 'bg-card text-text shadow-sm ring-1 ring-border' : 'text-muted hover:text-text',
                )}
              >
                {o.icone}
                {o.rotulo}
              </button>
            );
          })}
        </div>
        <p className="mt-2 px-1 text-xs text-muted">
          {preferencia === 'sistema' ? 'Segue o modo claro ou escuro do seu celular.' : 'Fica salvo neste aparelho e na sua conta.'}
        </p>
      </div>
    </section>
  );
}
