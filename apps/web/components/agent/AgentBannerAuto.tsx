'use client';

import { useMemo } from 'react';
import type { ContextoUsuario } from '@meudia/shared';
import {
  useProfile,
  useTreinos,
  useSessoesSemana,
  useHabitos,
  useRegistrosHoje,
  useResumoMensal,
} from '../../hooks';
import { useAuth } from '../../hooks/useAuth';
import { AgentBanner } from './AgentBanner';

interface AgentBannerAutoProps {
  className?: string;
  onDismiss?: () => void;
}

/**
 * Banner do agente que constrói o ContextoUsuario automaticamente.
 * Ideal para páginas secundárias que não precisam montar o contexto manualmente.
 */
export function AgentBannerAuto({ className, onDismiss }: AgentBannerAutoProps) {
  const { user } = useAuth();
  const { data: profile } = useProfile();
  const { data: treinos } = useTreinos();
  const { data: sessoesSemana } = useSessoesSemana();
  const { data: habitos } = useHabitos();
  const { data: registrosHoje } = useRegistrosHoje();
  const now = useMemo(() => new Date(), []);
  const { data: resumoMensal } = useResumoMensal(now.getFullYear(), now.getMonth() + 1);

  const contexto: ContextoUsuario = useMemo(() => {
    const diaSemana = now.getDay() as 0 | 1 | 2 | 3 | 4 | 5 | 6;
    const treinoHoje = treinos?.find((t) => t.dia_semana === diaSemana) ?? null;
    const hojeStr = now.toISOString().split('T')[0];
    const sessoesConcluidas = sessoesSemana?.filter((s) => s.concluido).length ?? 0;
    const treinoHojeConcluido = sessoesSemana?.some(
      (s) => s.treino_id === treinoHoje?.id && s.data === hojeStr && s.concluido,
    ) ?? false;

    const habitosAtivos = habitos?.filter(
      (h) => h.ativo && (h.frequencia === 'diario' || h.dias_semana.includes(diaSemana)),
    ) ?? [];
    const registrosMap = new Map<string, boolean>();
    registrosHoje?.forEach((r) => {
      if (r.concluido) registrosMap.set(r.habito_id, true);
    });
    const habitosConcluidos = habitosAtivos.filter((h) => registrosMap.has(h.id)).length;

    return {
      userId: user?.id ?? '',
      nome: profile?.nome ?? user?.email?.split('@')[0] ?? 'Usuário',
      objetivo: profile?.objetivo ?? null,
      horaAtual: now.getHours(),
      diaSemana,
      treinoHoje: treinoHoje
        ? {
            nome: treinoHoje.nome,
            exercicios: treinoHoje.exercicios?.length ?? 0,
            concluido: treinoHojeConcluido,
          }
        : null,
      sessoesSemana: sessoesConcluidas,
      metaTreinosSemana: 5,
      habitosTotal: habitosAtivos.length,
      habitosConcluidos,
      habitosPendentes: habitosAtivos
        .filter((h) => !registrosMap.has(h.id))
        .map((h) => h.nome),
      percentualHabitos:
        habitosAtivos.length > 0
          ? Math.round((habitosConcluidos / habitosAtivos.length) * 100)
          : 0,
      compromissosHoje: 0,
      proximoCompromisso: null,
      saldoMes: resumoMensal?.saldo ?? 0,
      despesasMes: resumoMensal?.totalDespesas ?? 0,
      receitasMes: resumoMensal?.totalReceitas ?? 0,
      streakAtual: 0,
      scoreHoje: 0,
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [treinos, sessoesSemana, habitos, registrosHoje, resumoMensal, profile, user]);

  return <AgentBanner contexto={contexto} className={className} onDismiss={onDismiss} />;
}
