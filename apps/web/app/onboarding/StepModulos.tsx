'use client';

import { clsx } from 'clsx';
import {
  Dumbbell,
  CheckSquare,
  Utensils,
  Wallet,
  Calendar,
  Pill,
  CreditCard,
  ShoppingCart,
  Car,
} from 'lucide-react';
import type { OnboardingData } from './page';

interface StepModulosProps {
  data: OnboardingData;
  onChange: (partial: Partial<OnboardingData>) => void;
}

const modulos = [
  { id: 'treinos', label: 'Treinos', desc: 'Organize seus treinos de musculação', icon: <Dumbbell size={20} /> },
  { id: 'habitos', label: 'Hábitos', desc: 'Acompanhe hábitos diários e streaks', icon: <CheckSquare size={20} /> },
  { id: 'dieta', label: 'Dieta', desc: 'Controle calorias, macros e hidratação', icon: <Utensils size={20} /> },
  { id: 'financas', label: 'Finanças', desc: 'Registre receitas e despesas', icon: <Wallet size={20} /> },
  { id: 'agenda', label: 'Agenda', desc: 'Compromissos e lembretes', icon: <Calendar size={20} /> },
  { id: 'medicamentos', label: 'Medicamentos', desc: 'Controle de remédios e estoque', icon: <Pill size={20} /> },
  { id: 'assinaturas', label: 'Assinaturas', desc: 'Gerencie serviços recorrentes', icon: <CreditCard size={20} /> },
  { id: 'compras', label: 'Compras', desc: 'Listas de compras inteligentes', icon: <ShoppingCart size={20} /> },
  { id: 'veiculo', label: 'Veículo', desc: 'Manutenções e custos do carro', icon: <Car size={20} /> },
];

export function StepModulos({ data, onChange }: StepModulosProps) {
  const toggleModule = (id: string) => {
    const current = data.modulos;
    const updated = current.includes(id)
      ? current.filter((m) => m !== id)
      : [...current, id];
    onChange({ modulos: updated });
  };

  return (
    <div>
      <h2 className="font-syne text-2xl font-bold text-text">Módulos ativos</h2>
      <p className="mt-1 text-sm text-muted">
        Escolha quais módulos você quer usar. Pode mudar depois.
      </p>

      <div className="mt-6 flex flex-col gap-2">
        {modulos.map((mod) => {
          const active = data.modulos.includes(mod.id);
          return (
            <button
              key={mod.id}
              onClick={() => toggleModule(mod.id)}
              className={clsx(
                'flex items-center gap-3 rounded-lg border px-4 py-3 text-left transition-all duration-200',
                active
                  ? 'border-accent/30 bg-accent/[0.06]'
                  : 'border-border bg-card2 opacity-60',
              )}
            >
              <div
                className={clsx(
                  'flex h-8 w-8 items-center justify-center rounded-lg',
                  active ? 'bg-accent/[0.14] text-accent' : 'bg-card text-muted',
                )}
              >
                {mod.icon}
              </div>
              <div className="flex-1">
                <span className="block text-sm font-medium text-text">{mod.label}</span>
                <span className="block text-xs text-muted">{mod.desc}</span>
              </div>
              <div
                className={clsx(
                  'flex h-5 w-5 items-center justify-center rounded border transition-colors',
                  active
                    ? 'border-accent bg-accent text-white'
                    : 'border-muted/40 bg-transparent',
                )}
              >
                {active && (
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <path d="M2 6L5 9L10 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
