'use client';

import { Plus, Trash2 } from 'lucide-react';
import { Input } from '../../components/ui/Input';
import { mascaraBRL } from '../../lib/financas-ui';
import type { OnboardingData } from './page';

export interface CarteiraOnboarding {
  id: string;
  negativo?: boolean;
  nome: string;
  /** Dígitos da máscara BRL (centavos). */
  digitos: string;
}

export const MAX_CARTEIRAS_ONBOARDING = 5;

interface StepCarteirasProps {
  data: OnboardingData;
  onChange: (partial: Partial<OnboardingData>) => void;
}

/** Primeiro passo de finanças: um banco/carteira + quanto tem hoje, com "+ adicionar outro". Opcional. */
export function StepCarteiras({ data, onChange }: StepCarteirasProps) {
  const linhas = data.carteiras;
  const set = (i: number, parcial: Partial<CarteiraOnboarding>) =>
    onChange({ carteiras: linhas.map((l, j) => (j === i ? { ...l, ...parcial } : l)) });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-syne text-2xl font-bold text-text">Onde fica seu dinheiro?</h2>
        <p className="mt-2 text-sm text-muted">
          Diga o banco (ou a carteira) e quanto tem hoje. Assim o MeuDia mostra quanto você tem e quanto vai ter no fim do mês.
        </p>
      </div>
      <ul className="space-y-4">
        {linhas.map((l, i) => (
          <li key={l.id} className="space-y-3 rounded-lg border border-border bg-card2/50 p-3">
            <Input
              id={`onb-carteira-nome-${i}`}
              label={`Banco ou carteira ${i + 1}`}
              placeholder={i === 0 ? 'Ex.: Nubank' : 'Ex.: Caixa, Carteira'}
              value={l.nome}
              maxLength={60}
              onChange={(e) => set(i, { nome: e.target.value })}
            />
            <label className="flex min-h-[44px] items-center gap-2 text-sm text-muted">
              <input type="checkbox" checked={!!l.negativo} onChange={(e) => set(i, { negativo: e.target.checked })} />
              Está negativo
            </label>
            <div className="flex items-end gap-2">
              <div className="min-w-0 flex-1">
                <Input
                  id={`onb-carteira-saldo-${i}`}
                  label={`Quanto tem hoje (${i + 1})`}
                  type="text"
                  inputMode="decimal"
                  autoComplete="off"
                  placeholder="R$ 0,00"
                  value={mascaraBRL(l.digitos).exibicao}
                  onChange={(e) => set(i, { digitos: mascaraBRL(e.target.value).digitos, negativo: e.target.value.includes('-') || l.negativo })}
                />
              </div>
              {linhas.length > 1 && (
                <button
                  type="button"
                  onClick={() => onChange({ carteiras: linhas.filter((_, j) => j !== i) })}
                  className="flex h-11 w-11 items-center justify-center rounded-lg text-muted hover:bg-card2 hover:text-red"
                  aria-label={`Remover banco ${i + 1}`}
                >
                  <Trash2 size={16} />
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
      {linhas.length < MAX_CARTEIRAS_ONBOARDING && (
        <button
          type="button"
          onClick={() => onChange({ carteiras: [...linhas, { id: crypto.randomUUID(), nome: '', digitos: '' }] })}
          className="inline-flex min-h-[44px] items-center gap-2 text-sm font-medium text-accent hover:underline"
        >
          <Plus size={16} aria-hidden="true" /> adicionar outro
        </button>
      )}
      <p className="text-xs text-muted">Pode deixar em branco e cadastrar depois em Bancos e carteira.</p>
    </div>
  );
}
