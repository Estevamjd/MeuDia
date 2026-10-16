'use client';

import { Input } from '../../components/ui/Input';
import type { OnboardingData } from './page';

interface StepFinancasProps {
  data: OnboardingData;
  onChange: (partial: Partial<OnboardingData>) => void;
}

/** Único passo do onboarding no modo Finanças (sem objetivo/peso/módulos). */
export function StepFinancas({ data, onChange }: StepFinancasProps) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-syne text-2xl font-bold text-text">Bem-vinda ao MeuDia Finanças</h2>
        <p className="mt-2 text-sm text-muted">
          Cadastre sua renda e suas contas para ver quanto entra, quanto sai e quanto sobra no mês. Você
          recebe lembretes antes de cada vencimento.
        </p>
      </div>
      <Input
        label="Como podemos te chamar?"
        value={data.nome}
        onChange={(e) => onChange({ nome: e.target.value })}
        autoComplete="given-name"
      />
      <ol className="list-decimal space-y-1 pl-5 text-sm text-muted">
        <li>Cadastre sua renda em Orçamento.</li>
        <li>Adicione suas contas e assinaturas com o dia do vencimento.</li>
        <li>Ative os lembretes para ser avisada antes de vencer.</li>
      </ol>
    </div>
  );
}
