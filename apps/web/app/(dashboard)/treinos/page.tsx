'use client';

import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { format, getDay } from 'date-fns';
import { Dumbbell, Plus, Timer as TimerIcon } from 'lucide-react';
import { DIAS_SEMANA_CURTO } from '@meudia/shared';
import type { Exercicio, SessaoTreino, Treino } from '@meudia/shared';
import { calcularDescansoSugerido } from '@meudia/ai';
import type { ContextoUsuario } from '@meudia/shared';

import {
  useTreinos,
  useSessoesSemana,
  useIniciarSessao,
  useFinalizarSessao,
  useAdicionarExercicio,
  useAtualizarExercicio,
  useExcluirExercicio,
  useRegistrarSerie,
  useAtualizarSerie,
  useSeriesDaSessao,
  useScoreHoje,
  useStreak,
  useProfile,
  useHabitos,
  useRegistrosHoje,
  useResumoMensal,
} from '../../../hooks';
import { useAuth } from '../../../hooks/useAuth';

import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { StatCard } from '../../../components/ui/StatCard';
import { WeekProgress } from '../../../components/ui/WeekProgress';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog';
import { EmptyState } from '../../../components/ui/EmptyState';
import { SkeletonList } from '../../../components/ui/Skeleton';
import { useToast } from '../../../components/ui/Toast';
import { AgentBanner, TimerDescanso } from '../../../components/agent';

import { ExercicioCard } from '../../../components/modules/ExercicioCard';
import {
  AddExercicioModal,
  type ExercicioFormData,
} from '../../../components/modules/AddExercicioModal';

// --- Helpers ---

type DayStatus = 'done' | 'today' | 'pending' | 'rest' | 'missed';

/** Map JS getDay (0=Sun) to our Monday-based index (0=Mon..6=Sun) */
function jsToMondayIndex(jsDay: number): number {
  return jsDay === 0 ? 6 : jsDay - 1;
}

function buildWeekDayStatuses(
  treinos: Treino[],
  sessoes: SessaoTreino[],
  today: Date,
): DayStatus[] {
  const todayJsDay = getDay(today);
  const todayMonIdx = jsToMondayIndex(todayJsDay);

  // Map dia_semana (0=Dom) -> treino exists
  const treinoPorDia = new Map<number, boolean>();
  treinos.forEach((t) => {
    if (t.tipo !== 'descanso') treinoPorDia.set(t.dia_semana, true);
  });

  // Map dia_semana -> sessao concluida
  const sessaoPorDia = new Map<number, boolean>();
  sessoes.forEach((s) => {
    if (s.concluido) {
      const d = getDay(new Date(s.data + 'T12:00:00'));
      sessaoPorDia.set(d, true);
    }
  });

  // Build 7 statuses from Monday(0) to Sunday(6)
  const monToSunJsDays = [1, 2, 3, 4, 5, 6, 0]; // Mon=1..Sun=0

  return monToSunJsDays.map((jsDay, monIdx) => {
    const hasTreino = treinoPorDia.get(jsDay);
    const done = sessaoPorDia.get(jsDay);

    if (monIdx === todayMonIdx) return done ? 'done' : 'today';
    if (!hasTreino) return 'rest';
    if (done) return 'done';
    if (monIdx < todayMonIdx) return 'missed';
    return 'pending';
  });
}

// --- Component ---

export default function TreinosPage() {
  const toast = useToast();
  const today = useMemo(() => new Date(), []);
  const todayJsDay = getDay(today); // 0=Sun..6=Sat

  // Tabs use Monday-based index (0=Mon..6=Sun)
  const [selectedTab, setSelectedTab] = useState(() => jsToMondayIndex(todayJsDay));

  // Session state
  const [activeSessaoId, setActiveSessaoId] = useState<string | null>(null);
  const [sessionStartTime, setSessionStartTime] = useState<number | null>(null);

  // Rest timer (TimerDescanso)
  const [restTimer, setRestTimer] = useState<{
    show: boolean;
    seconds: number;
    serieAtual: number;
    totalSeries: number;
    proximaSerie?: { carga: number | null; reps: string };
  }>({
    show: false,
    seconds: 60,
    serieAtual: 1,
    totalSeries: 1,
  });

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingExercicio, setEditingExercicio] = useState<Exercicio | null>(null);
  const [deletingExercicio, setDeletingExercicio] = useState<Exercicio | null>(null);
  const [dismissedAI, setDismissedAI] = useState(false);

  // --- Data hooks ---
  const { user } = useAuth();
  const { data: profile } = useProfile();
  const { data: treinos, isLoading: loadingTreinos } = useTreinos();
  const { data: sessoes, isLoading: loadingSessoes } = useSessoesSemana();
  const { data: scoreHoje } = useScoreHoje();
  const { data: streak } = useStreak();
  const { data: seriesDaSessao } = useSeriesDaSessao(activeSessaoId ?? undefined);
  const { data: habitos } = useHabitos();
  const { data: registrosHoje } = useRegistrosHoje();
  const { data: resumoMensal } = useResumoMensal(today.getFullYear(), today.getMonth() + 1);

  // --- Mutations ---
  const iniciarSessao = useIniciarSessao();
  const finalizarSessao = useFinalizarSessao();
  const adicionarExercicio = useAdicionarExercicio();
  const atualizarExercicio = useAtualizarExercicio();
  const excluirExercicio = useExcluirExercicio();
  const registrarSerie = useRegistrarSerie();
  const atualizarSerie = useAtualizarSerie();

  // --- Derived data ---

  // Convert tab index (Mon-based) to JS day for data lookup
  const monToSunJsDays = [1, 2, 3, 4, 5, 6, 0];
  const selectedJsDay = monToSunJsDays[selectedTab];

  const treinosDoDia = useMemo(
    () => (treinos ?? []).filter((t) => t.dia_semana === selectedJsDay),
    [treinos, selectedJsDay],
  );

  const treinoAtivo = treinosDoDia[0]; // Primary treino for the day
  const exercicios = useMemo(() => treinoAtivo?.exercicios ?? [], [treinoAtivo]);
  const isDiaDescanso =
    treinosDoDia.length === 0 ||
    treinosDoDia.every((t) => t.tipo === 'descanso');

  // Detect active session from this week's sessions
  useEffect(() => {
    if (!sessoes) return;
    const ativa = sessoes.find((s) => !s.concluido);
    if (ativa) {
      setActiveSessaoId(ativa.id);
      setSessionStartTime(new Date(ativa.created_at).getTime());
    }
  }, [sessoes]);

  // Week progress
  const weekStatuses = useMemo(
    () => buildWeekDayStatuses(treinos ?? [], sessoes ?? [], today),
    [treinos, sessoes, today],
  );

  // Stats
  const treinosNaSemana = useMemo(
    () => (sessoes ?? []).filter((s) => s.concluido).length,
    [sessoes],
  );

  const duracaoMedia = useMemo(() => {
    const concluidas = (sessoes ?? []).filter((s) => s.concluido && s.duracao_minutos);
    if (concluidas.length === 0) return 0;
    const total = concluidas.reduce((acc, s) => acc + (s.duracao_minutos ?? 0), 0);
    return Math.round(total / concluidas.length);
  }, [sessoes]);

  // Contexto do agente IA
  const contextoAgente: ContextoUsuario = useMemo(() => {
    const diaSemana = todayJsDay as 0 | 1 | 2 | 3 | 4 | 5 | 6;
    const hojeStr = format(today, 'yyyy-MM-dd');
    const treinoHojeConcluido = sessoes?.some(
      (s) => s.treino_id === treinoAtivo?.id && s.data === hojeStr && s.concluido,
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
      horaAtual: today.getHours(),
      diaSemana,
      treinoHoje: treinoAtivo
        ? {
            nome: treinoAtivo.nome,
            exercicios: treinoAtivo.exercicios?.length ?? 0,
            concluido: treinoHojeConcluido,
          }
        : null,
      sessoesSemana: treinosNaSemana,
      metaTreinosSemana: 5,
      habitosTotal: habitosAtivos.length,
      habitosConcluidos,
      habitosPendentes: habitosAtivos.filter((h) => !registrosMap.has(h.id)).map((h) => h.nome),
      percentualHabitos: habitosAtivos.length > 0 ? Math.round((habitosConcluidos / habitosAtivos.length) * 100) : 0,
      compromissosHoje: 0,
      proximoCompromisso: null,
      saldoMes: resumoMensal?.saldo ?? 0,
      despesasMes: resumoMensal?.totalDespesas ?? 0,
      receitasMes: resumoMensal?.totalReceitas ?? 0,
      streakAtual: streak ?? 0,
      scoreHoje: typeof scoreHoje === 'number' ? scoreHoje : ((scoreHoje as { total?: number })?.total ?? 0),
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [treinos, sessoes, habitos, registrosHoje, resumoMensal, profile, user, streak, scoreHoje]);

  // --- Elapsed timer for active session ---
  const [elapsed, setElapsed] = useState(0);
  const elapsedRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!sessionStartTime) {
      setElapsed(0);
      return;
    }

    const tick = () => {
      setElapsed(Math.floor((Date.now() - sessionStartTime) / 1000));
    };
    tick();
    elapsedRef.current = setInterval(tick, 1000);
    return () => {
      if (elapsedRef.current) clearInterval(elapsedRef.current);
    };
  }, [sessionStartTime]);

  const formatElapsed = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // --- Actions ---

  const handleIniciarTreino = useCallback(async () => {
    if (!treinoAtivo) {
      toast.warning('Nenhum treino cadastrado para hoje.');
      return;
    }
    try {
      const sessao = await iniciarSessao.mutateAsync(treinoAtivo.id);
      setActiveSessaoId(sessao.id);
      setSessionStartTime(Date.now());
      toast.success('Treino iniciado!');
    } catch {
      toast.error('Erro ao iniciar treino.');
    }
  }, [treinoAtivo, iniciarSessao, toast]);

  const handleFinalizarTreino = useCallback(async () => {
    if (!activeSessaoId || !sessionStartTime) return;
    const duracaoMin = Math.round((Date.now() - sessionStartTime) / 60000);
    try {
      await finalizarSessao.mutateAsync({
        sessaoId: activeSessaoId,
        duracao: duracaoMin,
      });
      setActiveSessaoId(null);
      setSessionStartTime(null);
      toast.success(`Treino finalizado! Duracao: ${duracaoMin} min`);
    } catch {
      toast.error('Erro ao finalizar treino.');
    }
  }, [activeSessaoId, sessionStartTime, finalizarSessao, toast]);

  const handleAddExercicio = useCallback(
    async (data: ExercicioFormData) => {
      if (!treinoAtivo) return;
      try {
        await adicionarExercicio.mutateAsync({
          treino_id: treinoAtivo.id,
          nome: data.nome,
          series: data.series,
          repeticoes: data.repeticoes,
          carga: data.carga,
          tempo_descanso: data.tempo_descanso,
          observacao: data.observacao,
          ordem: exercicios.length,
        });
        setShowAddModal(false);
        toast.success('Exercicio adicionado!');
      } catch {
        toast.error('Erro ao adicionar exercicio.');
      }
    },
    [treinoAtivo, adicionarExercicio, exercicios.length, toast],
  );

  const handleEditExercicio = useCallback(
    async (data: ExercicioFormData) => {
      if (!editingExercicio) return;
      try {
        await atualizarExercicio.mutateAsync({
          id: editingExercicio.id,
          data: {
            nome: data.nome,
            series: data.series,
            repeticoes: data.repeticoes,
            carga: data.carga,
            tempo_descanso: data.tempo_descanso,
            observacao: data.observacao,
          },
        });
        setEditingExercicio(null);
        toast.success('Exercicio atualizado!');
      } catch {
        toast.error('Erro ao atualizar exercicio.');
      }
    },
    [editingExercicio, atualizarExercicio, toast],
  );

  const handleDeleteExercicio = useCallback(async () => {
    if (!deletingExercicio) return;
    try {
      await excluirExercicio.mutateAsync(deletingExercicio.id);
      setDeletingExercicio(null);
      toast.success('Exercicio excluido.');
    } catch {
      toast.error('Erro ao excluir exercicio.');
    }
  }, [deletingExercicio, excluirExercicio, toast]);

  const handleSerieComplete = useCallback(
    async (data: {
      exercicio_id: string;
      numero_serie: number;
      carga_usada: number | null;
      reps_feitas: number | null;
      concluido: boolean;
      id?: string;
    }) => {
      if (!activeSessaoId) return;

      try {
        if (data.id) {
          // Update existing serie
          await atualizarSerie.mutateAsync({
            id: data.id,
            data: {
              carga_usada: data.carga_usada,
              reps_feitas: data.reps_feitas,
              concluido: data.concluido,
            },
          });
        } else {
          // Register new serie
          await registrarSerie.mutateAsync({
            sessao_id: activeSessaoId,
            exercicio_id: data.exercicio_id,
            numero_serie: data.numero_serie,
            carga_usada: data.carga_usada,
            reps_feitas: data.reps_feitas,
            concluido: data.concluido,
          });
        }

        // Start rest timer when serie is marked complete
        if (data.concluido) {
          const exercicio = exercicios.find((e) => e.id === data.exercicio_id);
          const tempoDescanso = calcularDescansoSugerido(
            exercicio?.tempo_descanso ?? null,
            data.carga_usada,
            data.numero_serie,
            exercicio?.series ?? 1,
          );
          const proximaSerieNum = data.numero_serie + 1;
          setRestTimer({
            show: true,
            seconds: tempoDescanso,
            serieAtual: data.numero_serie,
            totalSeries: exercicio?.series ?? 1,
            proximaSerie: proximaSerieNum <= (exercicio?.series ?? 1)
              ? { carga: exercicio?.carga ?? null, reps: String(exercicio?.repeticoes ?? '') }
              : undefined,
          });
        }
      } catch {
        toast.error('Erro ao registrar serie.');
      }
    },
    [activeSessaoId, atualizarSerie, registrarSerie, exercicios, toast],
  );

  // --- Tab labels with muscle group ---
  const tabLabels = useMemo(() => {
    const monToSun = [1, 2, 3, 4, 5, 6, 0];
    // DIAS_SEMANA_CURTO is indexed 0=Dom..6=Sab
    return monToSun.map((jsDay, monIdx) => {
      const label = DIAS_SEMANA_CURTO[jsDay];
      const treino = (treinos ?? []).find((t) => t.dia_semana === jsDay);
      return {
        short: label,
        treino: treino?.nome ?? null,
        isToday: monIdx === jsToMondayIndex(todayJsDay),
      };
    });
  }, [treinos, todayJsDay]);

  const isLoading = loadingTreinos || loadingSessoes;

  // -------------------------------------------------------------------
  // RENDER
  // -------------------------------------------------------------------

  return (
    <div className="animate-fadeSlide flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="font-syne text-3xl font-bold text-text">Treinos</h1>
        {activeSessaoId ? (
          <Button
            variant="danger"
            onClick={handleFinalizarTreino}
            isLoading={finalizarSessao.isPending}
          >
            <TimerIcon size={16} />
            Finalizar Treino
          </Button>
        ) : (
          <Button onClick={handleIniciarTreino} isLoading={iniciarSessao.isPending}>
            <Dumbbell size={16} />
            Iniciar Treino
          </Button>
        )}
      </div>

      {/* Active session elapsed */}
      {activeSessaoId && sessionStartTime && (
        <Card variant="orange" className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-orange/20">
              <TimerIcon size={20} className="text-orange" />
            </div>
            <div>
              <p className="text-sm font-medium text-text">Treino em andamento</p>
              <p className="text-xs text-muted">{treinoAtivo?.nome}</p>
            </div>
          </div>
          <span className="font-syne text-2xl font-bold text-orange">
            {formatElapsed(elapsed)}
          </span>
        </Card>
      )}

      {/* Week progress */}
      <WeekProgress days={weekStatuses} />

      {/* Stats row */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Treinos na semana"
          value={treinosNaSemana}
          icon={<Dumbbell size={16} />}
        />
        <StatCard
          label="Sequencia atual"
          value={`${streak ?? 0} dias`}
          tag={
            (streak ?? 0) >= 7
              ? { text: 'Fogo!', color: 'orange' as const }
              : undefined
          }
        />
        <StatCard label="Duracao media" value={`${duracaoMedia} min`} />
        <StatCard
          label="Total no mes"
          value={treinosNaSemana}
          tag={{ text: format(today, 'MMM'), color: 'purple' as const }}
        />
      </div>

      {/* Agente IA — Banner dinâmico */}
      {!dismissedAI && (
        <AgentBanner
          contexto={contextoAgente}
          onDismiss={() => setDismissedAI(true)}
        />
      )}

      {/* Day selector tabs */}
      <div className="flex gap-1 overflow-x-auto rounded-lg bg-card2 p-1">
        {tabLabels.map((tab, i) => (
          <button
            key={i}
            onClick={() => setSelectedTab(i)}
            className={`flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-md px-2 py-2.5 text-xs transition-all duration-200 ${
              selectedTab === i
                ? 'bg-orange text-bg font-bold shadow-sm'
                : tab.isToday
                  ? 'text-orange hover:bg-card'
                  : 'text-muted hover:bg-card hover:text-text'
            }`}
          >
            <span className="font-medium">{tab.short}</span>
            {tab.treino && (
              <span className="max-w-full truncate text-[10px] opacity-80">
                {tab.treino}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Timer de descanso inteligente */}
      <TimerDescanso
        isOpen={restTimer.show}
        tempoInicial={restTimer.seconds}
        serieAtual={restTimer.serieAtual}
        totalSeries={restTimer.totalSeries}
        proximaSerie={restTimer.proximaSerie}
        onComplete={() => {
          setRestTimer((r) => ({ ...r, show: false }));
          toast.info('Descanso finalizado! Próxima série.');
        }}
        onSkip={() => {
          setRestTimer((r) => ({ ...r, show: false }));
          toast.info('Descanso pulado.');
        }}
        onClose={() => setRestTimer((r) => ({ ...r, show: false }))}
      />

      {/* Exercise list */}
      {isLoading ? (
        <SkeletonList count={4} />
      ) : isDiaDescanso ? (
        <Card className="flex flex-col items-center py-12 text-center">
          <span className="mb-3 text-4xl">😴</span>
          <h3 className="font-syne text-lg font-bold text-text">Dia de descanso</h3>
          <p className="mt-1 text-sm text-muted">
            Aproveite para recuperar. O descanso faz parte do progresso!
          </p>
        </Card>
      ) : exercicios.length === 0 ? (
        <EmptyState
          icon={<Dumbbell size={40} />}
          title="Nenhum exercicio cadastrado"
          description="Adicione exercicios para este dia de treino."
          actionLabel="Adicionar Exercicio"
          onAction={() => setShowAddModal(true)}
        />
      ) : (
        <div className="flex flex-col gap-3">
          {exercicios.map((exercicio) => (
            <ExercicioCard
              key={exercicio.id}
              exercicio={exercicio}
              sessaoId={activeSessaoId}
              series={(seriesDaSessao ?? []).filter(
                (s) => s.exercicio_id === exercicio.id,
              )}
              onEdit={() => setEditingExercicio(exercicio)}
              onDelete={() => setDeletingExercicio(exercicio)}
              onSerieComplete={handleSerieComplete}
            />
          ))}

          {/* Add exercise button */}
          <Button
            variant="ghost"
            className="mt-2 w-full border border-dashed border-border py-4"
            onClick={() => setShowAddModal(true)}
          >
            <Plus size={16} />
            Adicionar Exercicio
          </Button>
        </div>
      )}

      {/* Add exercise modal */}
      <AddExercicioModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSubmit={handleAddExercicio}
        isLoading={adicionarExercicio.isPending}
      />

      {/* Edit exercise modal */}
      {editingExercicio && (
        <AddExercicioModal
          isOpen={!!editingExercicio}
          onClose={() => setEditingExercicio(null)}
          onSubmit={handleEditExercicio}
          isLoading={atualizarExercicio.isPending}
          title="Editar Exercicio"
          defaultValues={{
            nome: editingExercicio.nome,
            series: editingExercicio.series,
            repeticoes: editingExercicio.repeticoes,
            carga: editingExercicio.carga,
            tempo_descanso: editingExercicio.tempo_descanso,
            observacao: editingExercicio.observacao,
          }}
        />
      )}

      {/* Delete confirmation */}
      <ConfirmDialog
        isOpen={!!deletingExercicio}
        onClose={() => setDeletingExercicio(null)}
        onConfirm={handleDeleteExercicio}
        title="Excluir exercicio"
        message={`Tem certeza que deseja excluir "${deletingExercicio?.nome}"? Esta acao nao pode ser desfeita.`}
        confirmLabel="Excluir"
        isLoading={excluirExercicio.isPending}
      />
    </div>
  );
}
