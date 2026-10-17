'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { createClient } from '../../lib/supabase/client';
import { useAuth } from '../../hooks/useAuth';
import { Button } from '../../components/ui/Button';
import { StepObjetivo } from './StepObjetivo';
import { StepPerfil } from './StepPerfil';
import { StepModulos } from './StepModulos';
import { StepFinancas } from './StepFinancas';
import { StepCarteiras, type CarteiraOnboarding } from './StepCarteiras';
import { carteirasService } from '@meudia/api';
import { montarCarteirasOnboarding } from '../../lib/onboarding';
import { useAppMode } from '../../components/AppModeProvider';
import { rotaInicial } from '../../lib/app-mode';
import {
  MENSAGEM_ERRO_ONBOARDING,
  aplicarOnboardingNoCache,
  montarPerfilOnboarding,
  profileKey,
} from '../../lib/onboarding';
import type { Objetivo, Profile } from '@meudia/shared';

export interface OnboardingData {
  objetivo: Objetivo | null;
  nome: string;
  peso_atual: string;
  altura: string;
  meta_peso: string;
  meta_calorias: number;
  modulos: string[];
  /** Modo Finanças: "Onde fica seu dinheiro?" (linhas em branco são ignoradas). */
  carteiras: CarteiraOnboarding[];
}

const defaultData: OnboardingData = {
  objetivo: null,
  nome: '',
  peso_atual: '',
  altura: '',
  meta_peso: '',
  meta_calorias: 2200,
  modulos: ['treinos', 'habitos', 'dieta', 'financas', 'agenda', 'medicamentos', 'assinaturas', 'compras', 'veiculo'],
  carteiras: [],
};

export default function OnboardingPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user, loading: authLoading } = useAuth();
  const mode = useAppMode();
  const modoFinancas = mode === 'financas';
  const supabase = createClient();
  const [step, setStep] = useState(0);
  const [data, setData] = useState<OnboardingData>({
    ...defaultData,
  });
  const [saving, setSaving] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [rascunhoCarregado, setRascunhoCarregado] = useState(false);
  useEffect(() => {
    if (!user?.id) return;
    const chave = `onboarding-carteiras:${user.id}`;
    let linhas: CarteiraOnboarding[] = [];
    try { linhas = JSON.parse(localStorage.getItem(chave) ?? '[]'); } catch { /* storage indisponível */ }
    if (!Array.isArray(linhas) || !linhas.every((l) => typeof l.id === 'string' && typeof l.nome === 'string' && typeof l.digitos === 'string')) linhas = [];
    setData((prev) => ({ ...prev, carteiras: linhas.length ? linhas : [{ id: crypto.randomUUID(), nome: '', digitos: '' }] }));
    setRascunhoCarregado(true);
  }, [user?.id]);
  useEffect(() => {
    if (!user?.id || !rascunhoCarregado) return;
    try { localStorage.setItem(`onboarding-carteiras:${user.id}`, JSON.stringify(data.carteiras)); } catch { /* sem storage */ }
  }, [data.carteiras, user?.id, rascunhoCarregado]);

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
      router.replace('/login');
    }
  }, [authLoading, user, router]);

  const updateData = (partial: Partial<OnboardingData>) => {
    setData((prev) => ({ ...prev, ...partial }));
  };

  const concluir = async (pular: boolean) => {
    if (!user) {
      router.replace('/login');
      return;
    }
    if (saving) return;
    setSaving(true);
    setErro(null);

    // Upsert: cria a linha se o perfil não existir (senão o dashboard voltaria para cá). Sem onboarding_feito aqui:
    // perfil novo nasce com o DEFAULT false e um já concluído não é rebaixado se a etapa dos bancos falhar.
    const perfil = montarPerfilOnboarding(user, data, { modoFinancas, pular });
    const dadosPerfil: Partial<typeof perfil> = { ...perfil };
    delete dadosPerfil.onboarding_feito;
    const { error } = await supabase.from('profiles').upsert(dadosPerfil, { onConflict: 'id' });

    if (error) {
      setSaving(false);
      setErro(MENSAGEM_ERRO_ONBOARDING);
      return;
    }

    // "Onde fica seu dinheiro?": cria os bancos depois do perfil (carteiras.user_id → profiles).
    if (modoFinancas && !pular) {
      try {
        for (const { id, carteira } of montarCarteirasOnboarding(data.carteiras)) {
          await carteirasService.criarCarteiraOnboarding(user.id, id, carteira);
        }
      } catch {
        setSaving(false);
        setErro('Não foi possível salvar seus bancos. Verifique sua conexão e tente novamente.');
        return;
      }
    }

    const { error: erroConclusao } = await supabase.from('profiles').upsert(perfil, { onConflict: 'id' });
    if (erroConclusao) {
      setSaving(false);
      setErro(MENSAGEM_ERRO_ONBOARDING);
      return;
    }

    try { localStorage.removeItem(`onboarding-carteiras:${user.id}`); } catch { /* sem storage */ }
    // Atualiza o cache antes de navegar: o layout do dashboard lê ['profile', id].
    const key = profileKey(user.id);
    queryClient.setQueryData<Profile | null>(key, (old) => aplicarOnboardingNoCache(old, perfil));
    void queryClient.invalidateQueries({ queryKey: key });
    // replace: o "voltar" não retorna ao onboarding. `saving` segue true até a troca de rota.
    router.replace(rotaInicial(mode));
    router.refresh();
  };

  const handleFinish = () => concluir(false);
  const handleSkip = () => concluir(true);

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

  const steps = modoFinancas
    ? [<StepFinancas key="fin" data={data} onChange={updateData} />, <StepCarteiras key="cart" data={data} onChange={updateData} />]
    : [
        <StepObjetivo key="obj" data={data} onChange={updateData} />,
        <StepPerfil key="perf" data={data} onChange={updateData} />,
        <StepModulos key="mod" data={data} onChange={updateData} />,
      ];
  const ultimoPasso = steps.length - 1;

  return (
    <main className="flex min-h-screen items-center justify-center bg-bg px-4">
      <div className="w-full max-w-lg animate-fadeSlide">
        {/* Progress bar */}
        <div className="mb-8 flex items-center gap-2">
          {steps.map((_, i) => (
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
              className="text-sm text-muted transition-colors hover:text-text disabled:pointer-events-none disabled:opacity-50"
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
              {step < ultimoPasso ? (
                <Button onClick={() => setStep((s) => s + 1)}>Continuar</Button>
              ) : (
                <Button onClick={handleFinish} isLoading={saving}>
                  Concluir
                </Button>
              )}
            </div>
          </div>

          {erro && (
            <p role="alert" className="mt-4 text-center text-sm text-red">
              {erro}
            </p>
          )}

          {!modoFinancas && step === ultimoPasso && (
            <p className="mt-3 text-center text-xs text-muted">
              Ao pular, a IA funcionará com dados limitados
            </p>
          )}
        </div>
      </div>
    </main>
  );
}
