'use client';

import { Input } from '../../components/ui/Input';
import { User, Weight, Ruler, Target } from 'lucide-react';
import type { OnboardingData } from './page';

interface StepPerfilProps {
  data: OnboardingData;
  onChange: (partial: Partial<OnboardingData>) => void;
}

function calcularMetaCalorica(peso: number, altura: number, objetivo: string | null): number {
  const tmb = 88.362 + 13.397 * peso + 4.799 * (altura * 100) - 5.677 * 30;
  const fatorAtividade = 1.55;
  let meta = Math.round(tmb * fatorAtividade);

  if (objetivo === 'emagrecer') meta = Math.round(meta * 0.8);
  if (objetivo === 'ganhar_massa') meta = Math.round(meta * 1.15);

  return meta;
}

function recalcularMeta(
  updates: Partial<OnboardingData>,
  data: OnboardingData,
  onChange: (partial: Partial<OnboardingData>) => void,
) {
  const peso = parseFloat(updates.peso_atual ?? data.peso_atual);
  const altura = parseFloat(updates.altura ?? data.altura);

  if (peso > 0 && altura > 0) {
    updates.meta_calorias = calcularMetaCalorica(peso, altura, data.objetivo);
  }

  onChange(updates);
}

export function StepPerfil({ data, onChange }: StepPerfilProps) {
  return (
    <div>
      <h2 className="font-syne text-2xl font-bold text-text">Seu perfil</h2>
      <p className="mt-1 text-sm text-muted">
        Informações básicas para calcular suas metas
      </p>

      <div className="mt-6 flex flex-col gap-4">
        <Input
          label="Nome"
          placeholder="Como quer ser chamado?"
          icon={<User size={16} />}
          value={data.nome}
          onChange={(e) => onChange({ nome: e.target.value })}
        />

        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Peso atual (kg)"
            type="number"
            placeholder="82.5"
            step="0.1"
            icon={<Weight size={16} />}
            value={data.peso_atual}
            onChange={(e) =>
              recalcularMeta({ peso_atual: e.target.value }, data, onChange)
            }
          />
          <Input
            label="Altura (m)"
            type="number"
            placeholder="1.78"
            step="0.01"
            icon={<Ruler size={16} />}
            value={data.altura}
            onChange={(e) =>
              recalcularMeta({ altura: e.target.value }, data, onChange)
            }
          />
        </div>

        <Input
          label="Meta de peso (kg)"
          type="number"
          placeholder="78.0"
          step="0.1"
          icon={<Target size={16} />}
          value={data.meta_peso}
          onChange={(e) => onChange({ meta_peso: e.target.value })}
        />

        {data.meta_calorias > 0 && (
          <div className="rounded-lg border border-accent/20 bg-accent/[0.06] p-4">
            <p className="text-xs text-muted">Meta calórica sugerida</p>
            <p className="font-syne text-2xl font-bold text-accent">
              {data.meta_calorias} <span className="text-sm font-normal text-muted">kcal/dia</span>
            </p>
            <p className="mt-1 text-xs text-muted">
              Calculada com base no seu peso, altura e objetivo
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
