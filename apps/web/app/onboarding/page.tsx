'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '../../lib/supabase/client';
import { useAuth } from '../../hooks/useAuth';
import { Button } from '../../components/ui/Button';
import { StepObjetivo } from './StepObjetivo';
import { StepPerfil } from './StepPerfil';
import { StepModulos } from './StepModulos';
import type { Objetivo } from '@meudia/shared';

export interface OnboardingData {
  objetivo: Objetivo | null;
  nome: string;
  peso_atual: string;
  altura: string;
  meta_peso: string;
  meta_calorias: number;
  modulos: string[];
}

const defaultData: OnboardingData = {
  objetivo: null,
  nome: '',
  peso_atual: '',
  altura: '',
  meta_peso: '',
  meta_calorias: 2200,
  modulos: ['treinos', 'habitos', 'dieta', 'financas', 'agenda', 'medicamentos', 'assinaturas', 'compras', 'veiculo'],
};

export default function OnboardingPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const supabase = createClient();
  const [step, setStep] = useState(0);
  const [data, setData] = useState<OnboardingData>({
    ...defaultData,
  });
  const [saving, setSaving] = useState(false);

  // Quando o user carregar, preencher o nome
  useEffect(() => {
    if (user?.user_metadata?.nome) {
      setData((prev) => ({
        ...prev,
        nome: user.user_metadata.nome as string,
      }));
    }
  }, [user]);

  // Redirecionar para login se não estiver autenticado
  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [authLoading, user, router]);

  const updateData = (partial: Partial<OnboardingData>) => {
    setData((prev) => ({ ...prev, ...partial }));
  };

  const handleFinish = async () => {
    if (!user) {
      router.push('/login');
      return;
    }
    setSaving(true);

    const { error } = await supabase
      .from('profiles')
      .update({
        nome: data.nome || undefined,
        objetivo: data.objetivo,
        peso_atual: data.peso_atual ? parseFloat(data.peso_atual) : null,
        altura: data.altura ? parseFloat(data.altura) : null,
        meta_peso: data.meta_peso ? parseFloat(data.meta_peso) : null,
        meta_calorias: data.meta_calorias,
        onboarding_feito: true,
      })
      .eq('id', user.id);

    setSaving(false);
    if (!error) {
      router.push('/inicio');
      router.refresh();
    }
  };

  const handleSkip = async () => {
    if (!user) {
      router.push('/login');
      return;
    }
    setSaving(true);
    await supabase
      .from('profiles')
      .update({ onboarding_feito: true })
      .eq('id', user.id);
    setSaving(false);
    router.push('/inicio');
    router.refresh();
  };

  // Mostrar loading enquanto verifica autenticação
  if (authLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-bg">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent" />
      </main>
    );
  }

  // Se não tem user, não renderizar (redirect em andamento)
  if (!user) {
    return null;
  }

  const steps = [
    <StepObjetivo key="obj" data={data} onChange={updateData} />,
    <StepPerfil key="perf" data={data} onChange={updateData} />,
    <StepModulos key="mod" data={data} onChange={updateData} />,
  ];

  return (
    <main className="flex min-h-screen items-center justify-center bg-bg px-4">
      <div className="w-full max-w-lg animate-fadeSlide">
        {/* Progress bar */}
        <div className="mb-8 flex items-center gap-2">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className={`h-1 flex-1 rounded-full transition-colors ${
                i <= step ? 'bg-accent' : 'bg-card2'
              }`}
            />
          ))}
        </div>

        <div className="rounded-card border border-border bg-card p-8">
          {steps[step]}

          <div className="mt-8 flex items-center justify-between">
            <button
              onClick={handleSkip}
              className="text-sm text-muted transition-colors hover:text-text"
              disabled={saving}
            >
              Pular por agora
            </button>

            <div className="flex gap-3">
              {step > 0 && (
                <Button variant="ghost" onClick={() => setStep((s) => s - 1)}>
                  Voltar
                </Button>
              )}
              {step < 2 ? (
                <Button onClick={() => setStep((s) => s + 1)}>Continuar</Button>
              ) : (
                <Button onClick={handleFinish} isLoading={saving}>
                  Concluir
                </Button>
              )}
            </div>
          </div>

          {step === 2 && (
            <p className="mt-3 text-center text-xs text-muted">
              Ao pular, a IA funcionará com dados limitados
            </p>
          )}
        </div>
      </div>
    </main>
  );
}
