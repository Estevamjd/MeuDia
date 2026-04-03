'use client';

import { clsx } from 'clsx';
import { Heart, TrendingDown, Dumbbell, Zap } from 'lucide-react';
import type { Objetivo } from '@meudia/shared';
import type { OnboardingData } from './page';

interface StepObjetivoProps {
  data: OnboardingData;
  onChange: (partial: Partial<OnboardingData>) => void;
}

const objetivos: { value: Objetivo; label: string; desc: string; icon: React.ReactNode }[] = [
  {
    value: 'saude_geral',
    label: 'Saúde Geral',
    desc: 'Manter corpo e mente saudáveis',
    icon: <Heart size={24} />,
  },
  {
    value: 'emagrecer',
    label: 'Emagrecer',
    desc: 'Perder gordura com déficit calórico',
    icon: <TrendingDown size={24} />,
  },
  {
    value: 'ganhar_massa',
    label: 'Ganhar Massa',
    desc: 'Construir músculos com superávit',
    icon: <Dumbbell size={24} />,
  },
  {
    value: 'condicionamento',
    label: 'Condicionamento',
    desc: 'Melhorar resistência e performance',
    icon: <Zap size={24} />,
  },
];

export function StepObjetivo({ data, onChange }: StepObjetivoProps) {
  return (
    <div>
      <h2 className="font-syne text-2xl font-bold text-text">Qual é o seu objetivo?</h2>
      <p className="mt-1 text-sm text-muted">
        Isso nos ajuda a personalizar suas metas e dicas
      </p>

      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {objetivos.map((obj) => (
          <button
            key={obj.value}
            onClick={() => onChange({ objetivo: obj.value })}
            className={clsx(
              'flex flex-col items-start gap-2 rounded-card border p-4 text-left transition-all duration-200',
              data.objetivo === obj.value
                ? 'border-accent bg-accent/[0.08] glow-accent'
                : 'border-border bg-card2 hover:border-accent/30',
            )}
          >
            <span
              className={clsx(
                data.objetivo === obj.value ? 'text-accent' : 'text-muted',
              )}
            >
              {obj.icon}
            </span>
            <div>
              <span className="block text-sm font-medium text-text">{obj.label}</span>
              <span className="block text-xs text-muted">{obj.desc}</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
