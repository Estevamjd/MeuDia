'use client';

import { useState, useMemo, useCallback } from 'react';
import { format, subDays } from 'date-fns';
import { Plus, CheckSquare, Flame, Target } from 'lucide-react';
import type { Habito, HabitoInsert, RegistroHabito, ContextoUsuario } from '@meudia/shared';
import { DIAS_SEMANA_CURTO } from '@meudia/shared';
import { clsx } from 'clsx';

import {
  useHabitos,
  useCriarHabito,
  useAtualizarHabito,
  useExcluirHabito,
  useRegistrosHoje,
  useRegistrosSemana,
  useMarcarHabito,
  useStreak,
  useScoreHoje,
  useProfile,
  useTreinos,
  useSessoesSemana,
  useResumoMensal,
} from '../../../hooks';
import { useAuth } from '../../../hooks/useAuth';

import {
  Button,
  ProgressBar,
  StatCard,
  EmptyState,
  SkeletonList,
  SkeletonCard,
  ConfirmDialog,
  useToast,
} from '../../../components/ui';
import { AgentBanner } from '../../../components/agent';

import { HabitoCard } from '../../../components/modules/HabitoCard';
import { AddHabitoModal } from '../../../components/modules/AddHabitoModal';

export default function HabitosPage() {
  const toast = useToast();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const hoje = useMemo(() => new Date(), []);
  const hojeStr = format(hoje, 'yyyy-MM-dd');
  const diaSemana = hoje.getDay() as 0 | 1 | 2 | 3 | 4 | 5 | 6;

  // --- Data hooks ---
  const { user } = useAuth();
  const { data: profile } = useProfile();
  const { data: habitos, isLoading: loadingHabitos } = useHabitos();
  const { data: registrosHoje, isLoading: loadingRegistros } = useRegistrosHoje();
  const { data: registrosSemana, isLoading: loadingSemana } = useRegistrosSemana();
  const { data: streak, isLoading: loadingStreak } = useStreak();
  const { data: scoreHoje } = useScoreHoje();
  const { data: treinos } = useTreinos();
  const { data: sessoesSemana } = useSessoesSemana();
  const { data: resumoMensal } = useResumoMensal(hoje.getFullYear(), hoje.getMonth() + 1);

  // --- Mutations ---
  const criarHabito = useCriarHabito();
  const atualizarHabito = useAtualizarHabito();
  const excluirHabito = useExcluirHabito();
  const marcarHabito = useMarcarHabito();

  // --- Modal state ---
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingHabito, setEditingHabito] = useState<Habito | null>(null);
  const [deletingHabito, setDeletingHabito] = useState<Habito | null>(null);

  const isLoading = loadingHabitos || loadingRegistros || loadingSemana || loadingStreak;

  // --- Derived data ---
  const habitosAtivos = useMemo(() => {
    if (!habitos) return [];
    return habitos.filter((h) => h.ativo);
  }, [habitos]);

  const habitosHoje = useMemo(() => {
    return habitosAtivos.filter(
      (h) => h.frequencia === 'diario' || h.dias_semana.includes(diaSemana),
    );
  }, [habitosAtivos, diaSemana]);

  const registrosMap = useMemo(() => {
    const m = new Map<string, RegistroHabito>();
    if (!registrosHoje) return m;
    for (const r of registrosHoje) {
      m.set(r.habito_id, r);
    }
    return m;
  }, [registrosHoje]);

  const habitosConcluidos = useMemo(() => {
    return habitosHoje.filter((h) => {
      const reg = registrosMap.get(h.id);
      return reg?.concluido ?? false;
    }).length;
  }, [habitosHoje, registrosMap]);

  const percentualHabitos = habitosHoje.length > 0
    ? Math.round((habitosConcluidos / habitosHoje.length) * 100)
    : 0;

  const streakDias = streak ?? 0;

  // --- Week view data ---
  const semanaStatus = useMemo(() => {
    if (!registrosSemana || !habitosAtivos.length) {
      return Array(7).fill('pending') as string[];
    }

    const result: string[] = [];

    for (let i = 6; i >= 0; i--) {
      const dia = subDays(hoje, i);
      const diaStr = format(dia, 'yyyy-MM-dd');
      const diaDaSemana = dia.getDay() as 0 | 1 | 2 | 3 | 4 | 5 | 6;

      const habitosDoDia = habitosAtivos.filter(
        (h) => h.frequencia === 'diario' || h.dias_semana.includes(diaDaSemana),
      );

      if (habitosDoDia.length === 0) {
        result.push('rest');
        continue;
      }

      const registrosDoDia = registrosSemana.filter(
        (r) => r.data === diaStr && r.concluido,
      );
      const percentual = (registrosDoDia.length / habitosDoDia.length) * 100;

      if (percentual >= 80) result.push('done');
      else if (percentual >= 50) result.push('partial');
      else if (i === 0) result.push('today');
      else result.push('missed');
    }

    return result;
  }, [registrosSemana, habitosAtivos, hoje]);

  // --- Contexto do agente IA ---
  const contextoAgente: ContextoUsuario = useMemo(() => {
    const treinoHoje = treinos?.find((t) => t.dia_semana === diaSemana) ?? null;
    const hojeStr2 = format(hoje, 'yyyy-MM-dd');
    const sessoesConcluidas = sessoesSemana?.filter((s) => s.concluido).length ?? 0;
    const treinoHojeConcluido = sessoesSemana?.some(
      (s) => s.treino_id === treinoHoje?.id && s.data === hojeStr2 && s.concluido,
    ) ?? false;

    const habitosPendentes = habitosHoje
      .filter((h) => {
        const reg = registrosMap.get(h.id);
        return !(reg?.concluido);
      })
      .map((h) => h.nome);

    return {
      userId: user?.id ?? '',
      nome: profile?.nome ?? user?.email?.split('@')[0] ?? 'Usuário',
      objetivo: profile?.objetivo ?? null,
      horaAtual: hoje.getHours(),
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
      habitosTotal: habitosHoje.length,
      habitosConcluidos,
      habitosPendentes,
      percentualHabitos,
      compromissosHoje: 0,
      proximoCompromisso: null,
      saldoMes: resumoMensal?.saldo ?? 0,
      despesasMes: resumoMensal?.totalDespesas ?? 0,
      receitasMes: resumoMensal?.totalReceitas ?? 0,
      streakAtual: streakDias,
      scoreHoje: scoreHoje?.score ?? 0,
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [treinos, sessoesSemana, habitos, registrosHoje, resumoMensal, profile, user, streak, scoreHoje]);

  // --- Handlers ---
  const handleToggle = useCallback(
    (habitoId: string, concluido: boolean, valor: number) => {
      marcarHabito.mutate(
        { habitoId, data: hojeStr, concluido, valor },
        {
          onSuccess: () => {
            toast.success(concluido ? 'Hábito concluído!' : 'Hábito desmarcado');
          },
          onError: () => {
            toast.error('Erro ao atualizar hábito');
          },
        },
      );
    },
    [marcarHabito, hojeStr, toast],
  );

  const handleCriarHabito = useCallback(
    (data: HabitoInsert) => {
      criarHabito.mutate(data, {
        onSuccess: () => {
          toast.success('Hábito criado com sucesso!');
          setShowAddModal(false);
        },
        onError: () => {
          toast.error('Erro ao criar hábito');
        },
      });
    },
    [criarHabito, toast],
  );

  const handleEditarHabito = useCallback(
    (data: HabitoInsert) => {
      if (!editingHabito) return;
      atualizarHabito.mutate(
        { id: editingHabito.id, data },
        {
          onSuccess: () => {
            toast.success('Hábito atualizado!');
            setEditingHabito(null);
          },
          onError: () => {
            toast.error('Erro ao atualizar hábito');
          },
        },
      );
    },
    [atualizarHabito, editingHabito, toast],
  );

  const handleExcluirHabito = useCallback(() => {
    if (!deletingHabito) return;
    excluirHabito.mutate(deletingHabito.id, {
      onSuccess: () => {
        toast.success('Hábito excluído');
        setDeletingHabito(null);
      },
      onError: () => {
        toast.error('Erro ao excluir hábito');
      },
    });
  }, [excluirHabito, deletingHabito, toast]);

  // --- Week dot colors ---
  const dotColor = (status: string) => {
    switch (status) {
      case 'done':
        return 'bg-green';
      case 'partial':
        return 'bg-yellow';
      case 'today':
        return 'bg-orange glow-orange';
      case 'rest':
        return 'bg-card2';
      case 'missed':
        return 'bg-red/60';
      default:
        return 'bg-card2';
    }
  };

  const dotLabel = (status: string) => {
    switch (status) {
      case 'done':
        return 'Concluído (>=80%)';
      case 'partial':
        return 'Parcial (>=50%)';
      case 'today':
        return 'Hoje';
      case 'rest':
        return 'Descanso';
      case 'missed':
        return 'Abaixo de 50%';
      default:
        return 'Pendente';
    }
  };

  // --- Loading state ---
  if (isLoading) {
    return (
      <div className="animate-fadeSlide space-y-6">
        <div className="flex items-center justify-between">
          <div className="h-8 w-32 animate-pulse rounded bg-card2" />
          <div className="h-10 w-32 animate-pulse rounded-lg bg-card2" />
        </div>
        <SkeletonCard />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
        <SkeletonList count={4} />
      </div>
    );
  }

  // --- Empty state ---
  if (habitosAtivos.length === 0) {
    return (
      <div className="animate-fadeSlide space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="font-syne text-3xl font-bold text-text">Hábitos</h1>
          <Button onClick={() => setShowAddModal(true)}>
            <Plus size={16} />
            Novo Hábito
          </Button>
        </div>

        <EmptyState
          icon={<CheckSquare size={48} />}
          title="Nenhum hábito cadastrado"
          description="Crie seus primeiros hábitos para acompanhar sua rotina diária e ganhar pontos no score."
          actionLabel="Criar primeiro hábito"
          onAction={() => setShowAddModal(true)}
        />

        <AddHabitoModal
          isOpen={showAddModal}
          onClose={() => setShowAddModal(false)}
          onSubmit={handleCriarHabito}
          isLoading={criarHabito.isPending}
        />
      </div>
    );
  }

  return (
    <div className="animate-fadeSlide space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="font-syne text-3xl font-bold text-text">Hábitos</h1>
        <Button onClick={() => setShowAddModal(true)}>
          <Plus size={16} />
          Novo Hábito
        </Button>
      </div>

      {/* Progress bar + Stats */}
      <div className="space-y-4">
        <ProgressBar
          value={habitosConcluidos}
          max={habitosHoje.length}
          label={`Progresso de hoje - ${percentualHabitos}%`}
          showValue
          color={percentualHabitos >= 80 ? 'green' : percentualHabitos >= 50 ? 'orange' : 'red'}
        />

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <StatCard
            label="Total de hábitos"
            value={habitosAtivos.length}
            icon={<Target size={16} />}
            tag={{ text: `${habitosHoje.length} hoje`, color: 'purple' }}
          />
          <StatCard
            label="Concluídos hoje"
            value={habitosConcluidos}
            icon={<CheckSquare size={16} />}
            tag={{
              text: `de ${habitosHoje.length}`,
              color: percentualHabitos >= 80 ? 'green' : percentualHabitos >= 50 ? 'yellow' : 'red',
            }}
          />
          <StatCard
            label="Streak"
            value={streakDias}
            icon={<Flame size={16} />}
            tag={{
              text: streakDias === 1 ? 'dia' : 'dias',
              color: streakDias >= 7 ? 'green' : streakDias >= 3 ? 'yellow' : 'orange',
            }}
          />
        </div>
      </div>

      {/* Week view */}
      <div className="animate-fadeSlide rounded-card border border-border bg-card p-5">
        <h2 className="mb-4 font-syne text-sm font-semibold text-text">Últimos 7 dias</h2>
        <div className="flex items-center justify-between gap-2">
          {semanaStatus.map((status, i) => {
            const dia = subDays(hoje, 6 - i);
            const diaCurto = DIAS_SEMANA_CURTO[dia.getDay()];
            const diaNum = format(dia, 'dd');
            return (
              <div key={i} className="flex flex-col items-center gap-1.5">
                <span className="text-[10px] text-muted">{diaCurto}</span>
                <div
                  className={clsx(
                    'flex h-9 w-9 items-center justify-center rounded-full text-[10px] font-bold text-bg transition-all',
                    dotColor(status),
                    status === 'rest' && 'text-muted',
                    status === 'missed' && 'text-red',
                  )}
                  title={dotLabel(status)}
                  aria-label={`${diaCurto} ${diaNum}: ${dotLabel(status)}`}
                >
                  {diaNum}
                </div>
              </div>
            );
          })}
        </div>
        <div className="mt-3 flex items-center gap-4 text-[10px] text-muted">
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-full bg-green" /> {'>'}80%
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-full bg-yellow" /> {'>'}50%
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-full bg-red/60" /> {'<'}50%
          </span>
        </div>
      </div>

      {/* Agente IA — Banner dinâmico */}
      <AgentBanner contexto={contextoAgente} />

      {/* Habits list */}
      <div className="space-y-3">
        <h2 className="font-syne text-lg font-semibold text-text">
          Hábitos de hoje ({habitosHoje.length})
        </h2>
        {habitosHoje.length > 0 ? (
          <div className="space-y-3">
            {habitosHoje.map((habito) => (
              <HabitoCard
                key={habito.id}
                habito={habito}
                registro={registrosMap.get(habito.id)}
                onToggle={handleToggle}
                onEdit={(h) => setEditingHabito(h)}
                onDelete={(h) => setDeletingHabito(h)}
              />
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted">Nenhum hábito programado para hoje.</p>
        )}

        {/* Show habits not scheduled for today */}
        {habitosAtivos.length > habitosHoje.length && (
          <>
            <h2 className="mt-6 font-syne text-lg font-semibold text-muted">
              Outros hábitos ({habitosAtivos.length - habitosHoje.length})
            </h2>
            <div className="space-y-3 opacity-60">
              {habitosAtivos
                .filter(
                  (h) => h.frequencia !== 'diario' && !h.dias_semana.includes(diaSemana),
                )
                .map((habito) => (
                  <HabitoCard
                    key={habito.id}
                    habito={habito}
                    registro={undefined}
                    onToggle={handleToggle}
                    onEdit={(h) => setEditingHabito(h)}
                    onDelete={(h) => setDeletingHabito(h)}
                  />
                ))}
            </div>
          </>
        )}
      </div>

      {/* Add Modal */}
      <AddHabitoModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSubmit={handleCriarHabito}
        isLoading={criarHabito.isPending}
      />

      {/* Edit Modal */}
      <AddHabitoModal
        isOpen={!!editingHabito}
        onClose={() => setEditingHabito(null)}
        onSubmit={handleEditarHabito}
        defaultValues={
          editingHabito
            ? {
                nome: editingHabito.nome,
                icone: editingHabito.icone,
                frequencia: editingHabito.frequencia,
                dias_semana: editingHabito.dias_semana,
                meta: editingHabito.meta,
              }
            : undefined
        }
        isLoading={atualizarHabito.isPending}
      />

      {/* Delete Confirm */}
      <ConfirmDialog
        isOpen={!!deletingHabito}
        onClose={() => setDeletingHabito(null)}
        onConfirm={handleExcluirHabito}
        title="Excluir hábito"
        message={`Tem certeza que deseja excluir "${deletingHabito?.nome}"? Esta ação não pode ser desfeita.`}
        confirmLabel="Excluir"
        isLoading={excluirHabito.isPending}
      />
    </div>
  );
}
