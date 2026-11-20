'use client';

import type { ReactNode } from 'react';
import { clsx } from 'clsx';
import { Check, Monitor, Moon, Sun } from 'lucide-react';
import { useCorApp, useTema } from '../../hooks/useTema';
import type { PreferenciaTema } from '../../lib/tema';
import { CORES_APP, PALETA_CORES } from '../../lib/cores-app';

const OPCOES: { valor: PreferenciaTema; rotulo: string; icone: ReactNode }[] = [
  { valor: 'claro', rotulo: 'Claro', icone: <Sun size={16} aria-hidden="true" /> },
  { valor: 'escuro', rotulo: 'Escuro', icone: <Moon size={16} aria-hidden="true" /> },
  { valor: 'sistema', rotulo: 'Sistema', icone: <Monitor size={16} aria-hidden="true" /> },
];

/** Configurações › Aparência: Claro / Escuro / Sistema (igual ao celular) e a cor do app. Vale na hora e fica salvo. */
export function AparenciaTema() {
  const { preferencia, modo, escolher } = useTema();
  const corApp = useCorApp();
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
        <h3 id="config-cor-app" className="mt-4 px-1 text-sm font-medium text-text">
          Cor do app
        </h3>
        <div role="radiogroup" aria-labelledby="config-cor-app" className="mt-2 grid grid-cols-6 gap-1">
          {CORES_APP.map((c) => {
            const ativo = corApp.cor === c;
            const tons = PALETA_CORES[c][modo === 'light' ? 'claro' : 'escuro'];
            return (
              <button
                key={c}
                type="button"
                role="radio"
                aria-checked={ativo}
                data-cor={c}
                onClick={() => corApp.escolher(c)}
                className={clsx(
                  'flex min-h-[44px] min-w-[44px] flex-col items-center gap-1 rounded-lg py-1 text-[11px] transition-colors',
                  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent',
                  ativo ? 'font-semibold text-text' : 'text-muted hover:text-text',
                )}
              >
                <span
                  aria-hidden="true"
                  className={clsx('grid h-8 w-8 place-items-center rounded-full', ativo && 'ring-2 ring-text ring-offset-2 ring-offset-card')}
                  style={{ backgroundColor: tons.accent, color: tons.fg }}
                >
                  {ativo && <Check size={16} strokeWidth={3} />}
                </span>
                {PALETA_CORES[c].rotulo}
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
