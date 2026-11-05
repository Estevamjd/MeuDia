'use client';

import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { getDay } from 'date-fns';
import { AlertCircle, Dumbbell } from 'lucide-react';
import { DIAS_SEMANA } from '@meudia/shared';
import type { Exercicio } from '@meudia/shared';
import { calcularDescansoSugerido } from '@meudia/ai';

import {
  useTreinos,
  useSessoesSemana,
  useIniciarSessao,
  useFinalizarSessao,
  useCriarTreino,
  useAdicionarExercicio,
  useAtualizarExercicio,
  useExcluirExercicio,
  useRegistrarSerie,
  useAtualizarSerie,
  useSeriesDaSessao,
  useSeriesAnteriores,
  useLembreteTreino,
  useSalvarLembreteTreino,
} from '../../../hooks';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog';
import { EmptyState } from '../../../components/ui/EmptyState';
import { SkeletonList } from '../../../components/ui/Skeleton';
import { Modal } from '../../../components/ui/Modal';
import { Input } from '../../../components/ui/Input';
import { Button } from '../../../components/ui/Button';
import { useToast } from '../../../components/ui/Toast';
import { TimerDescanso } from '../../../components/agent';
import { AddExercicioModal, type ExercicioFormData } from '../../../components/modules/AddExercicioModal';
import { SeletorDias, type DiaSeletor } from '../../../components/treinos/SeletorDias';
import { ExercicioCaderno, LinkAcao, type MarcarSerie } from '../../../components/treinos/ExercicioCaderno';
import { LembreteTreino } from '../../../components/treinos/LembreteTreino';

// Segunda primeiro (S T Q Q S S D); valores de `treinos.dia_semana` (0 = domingo).
const ORDEM_SEMANA = [1, 2, 3, 4, 5, 6, 0] as const;
const LETRAS: Record<number, string> = { 0: 'D', 1: 'S', 2: 'T', 3: 'Q', 4: 'Q', 5: 'S', 6: 'S' };

interface Descanso {
  aberto: boolean;
  segundos: number;
  serie: number;
  total: number;
  proxima?: { carga: number | null; reps: string };
}

export default function TreinosPage() {
  const toast = useToast();
  const hoje = useMemo(() => getDay(new Date()), []);
  const [dia, setDia] = useState<number>(hoje);
  const [abertos, setAbertos] = useState<Record<string, boolean>>({});
  const [criandoTreino, setCriandoTreino] = useState(false);
  const [nomeTreino, setNomeTreino] = useState('');
  const [adicionando, setAdicionando] = useState(false);
  const [editando, setEditando] = useState<Exercicio | null>(null);
  const [excluindo, setExcluindo] = useState<Exercicio | null>(null);
  const [descanso, setDescanso] = useState<Descanso>({ aberto: false, segundos: 60, serie: 1, total: 1 });

  const treinosQ = useTreinos();
  const sessoesQ = useSessoesSemana({ noModoFinancas: true });
  const lembreteQ = useLembreteTreino();
  const salvarLembrete = useSalvarLembreteTreino();
  const iniciarSessao = useIniciarSessao();
  const finalizarSessao = useFinalizarSessao();
  const criarTreino = useCriarTreino();
  const adicionarExercicio = useAdicionarExercicio();
  const atualizarExercicio = useAtualizarExercicio();
  const excluirExercicio = useExcluirExercicio();
  const registrarSerie = useRegistrarSerie();
  const atualizarSerie = useAtualizarSerie();

  const treinos = useMemo(() => treinosQ.data ?? [], [treinosQ.data]);
  const treinosDoDia = treinos.filter((t) => t.dia_semana === dia);
  const treino = treinosDoDia.find((t) => t.tipo !== 'descanso') ?? null;
  const descansoDoDia = !treino ? treinosDoDia.find((t) => t.tipo === 'descanso') ?? null : null;
  const exercicios = useMemo(() => treino?.exercicios ?? [], [treino]);

  const sessaoAtiva = (sessoesQ.data ?? []).find((s) => !s.concluido && (!treino || s.treino_id === treino.id)) ?? null;
  const seriesQ = useSeriesDaSessao(sessaoAtiva?.id);
  const anterioresQ = useSeriesAnteriores(exercicios.map((e) => e.id), sessaoAtiva?.id ?? null);

  const dias: DiaSeletor[] = ORDEM_SEMANA.map((d) => {
    const doDia = treinos.filter((t) => t.dia_semana === d);
    const musculacao = doDia.find((t) => t.tipo !== 'descanso');
    return {
      diaSemana: d,
      letra: LETRAS[d] ?? '',
      nome: DIAS_SEMANA[d] ?? '',
      descanso: !musculacao && doDia.some((t) => t.tipo === 'descanso'),
      treino: musculacao?.nome ?? null,
    };
  });

  // Primeiro exercício aberto por padrão; a pessoa abre e fecha os outros.
  const estaAberto = (e: Exercicio, i: number) => abertos[e.id] ?? i === 0;

  const marcar = useCallback(
    async (serie: MarcarSerie) => {
      if (!treino) return;
      try {
        let sessaoId = sessaoAtiva?.id;
        if (!sessaoId) sessaoId = (await iniciarSessao.mutateAsync(treino.id)).id;
        if (serie.id) {
          await atualizarSerie.mutateAsync({
            id: serie.id,
            data: { carga_usada: serie.carga_usada, reps_feitas: serie.reps_feitas, concluido: serie.concluido },
          });
        } else {
          await registrarSerie.mutateAsync({
            sessao_id: sessaoId,
            exercicio_id: serie.exercicio_id,
            numero_serie: serie.numero_serie,
            carga_usada: serie.carga_usada,
            reps_feitas: serie.reps_feitas,
            concluido: serie.concluido,
          });
        }
        if (serie.concluido) {
          const ex = exercicios.find((e) => e.id === serie.exercicio_id);
          const total = ex?.series ?? 1;
          setDescanso({
            aberto: true,
            segundos: calcularDescansoSugerido(ex?.tempo_descanso ?? null, serie.carga_usada, serie.numero_serie, total),
            serie: serie.numero_serie,
            total,
            proxima: serie.numero_serie < total ? { carga: serie.carga_usada, reps: ex?.repeticoes ?? '' } : undefined,
          });
        }
      } catch {
        toast.error('Não deu para salvar a série. Tente de novo.');
      }
    },
    [treino, sessaoAtiva, iniciarSessao, atualizarSerie, registrarSerie, exercicios, toast],
  );

  const concluirTreino = async () => {
    if (!sessaoAtiva) return;
    const minutos = Math.max(1, Math.round((Date.now() - new Date(sessaoAtiva.created_at).getTime()) / 60000));
    try {
      await finalizarSessao.mutateAsync({ sessaoId: sessaoAtiva.id, duracao: minutos });
      toast.success(`Treino salvo: ${minutos} min.`);
    } catch {
      toast.error('Não deu para concluir o treino. Tente de novo.');
    }
  };

  const salvarTreinoNovo = async () => {
    const nome = nomeTreino.trim();
    if (!nome) return;
    try {
      await criarTreino.mutateAsync({ nome, dia_semana: dia as 0 | 1 | 2 | 3 | 4 | 5 | 6, tipo: 'musculacao' });
      setCriandoTreino(false);
      setNomeTreino('');
    } catch {
      toast.error('Não deu para criar o treino. Tente de novo.');
    }
  };

  const salvarExercicio = async (data: ExercicioFormData) => {
    try {
      if (editando) {
        await atualizarExercicio.mutateAsync({ id: editando.id, data });
        setEditando(null);
      } else if (treino) {
        await adicionarExercicio.mutateAsync({ ...data, treino_id: treino.id, ordem: exercicios.length });
        setAdicionando(false);
      }
    } catch {
      toast.error('Não deu para salvar o exercício. Tente de novo.');
    }
  };

  const confirmarExclusao = async () => {
    if (!excluindo) return;
    try {
      await excluirExercicio.mutateAsync(excluindo.id);
      setExcluindo(null);
    } catch {
      toast.error('Não deu para excluir o exercício. Tente de novo.');
    }
  };

  const nomeDia = DIAS_SEMANA[dia] ?? '';
  const contexto = treino?.nome ?? descansoDoDia?.nome ?? nomeDia;

  let conteudo: ReactNode;
  if (treinosQ.isLoading) {
    conteudo = (
      <div className="px-5 py-[18px]" aria-busy="true" aria-label="Carregando treino">
        <SkeletonList count={3} />
      </div>
    );
  } else if (treinosQ.isError) {
    conteudo = (
      <EmptyState
        icon={<AlertCircle size={36} aria-hidden="true" />}
        title="Não deu para carregar o treino."
        description="Confira a conexão e tente de novo."
        actionLabel="Tentar de novo"
        onAction={() => void treinosQ.refetch()}
      />
    );
  } else if (descansoDoDia) {
    conteudo = (
      <section className="border-b border-white/[0.07] px-5 py-[18px]">
        <p className="text-[10.5px] uppercase tracking-[1.6px] text-muted-text">{nomeDia}</p>
        <h2 className="mt-1 font-syne text-[22px] font-bold text-text">{descansoDoDia.nome}</h2>
        <p className="mt-1 text-[14.5px] text-muted-text">Sem musculação programada.</p>
      </section>
    );
  } else if (!treino) {
    conteudo = (
      <EmptyState
        icon={<Dumbbell size={36} aria-hidden="true" />}
        title={`Nenhum treino na ${nomeDia.toLowerCase()}.`}
        description="Crie o treino do dia e depois adicione os exercícios."
        actionLabel="Criar treino"
        onAction={() => setCriandoTreino(true)}
      />
    );
  } else if (exercicios.length === 0) {
    conteudo = (
      <EmptyState
        icon={<Dumbbell size={36} aria-hidden="true" />}
        title="Nenhum exercício neste treino."
        description="Adicione o primeiro com séries, repetições e carga."
        actionLabel="Adicionar exercício"
        onAction={() => setAdicionando(true)}
      />
    );
  } else {
    conteudo = (
      <>
        {exercicios.map((e, i) => (
          <ExercicioCaderno
            key={e.id}
            exercicio={e}
            posicao={i + 1}
            total={exercicios.length}
            anteriores={anterioresQ.data?.[e.id]}
            feitas={(seriesQ.data ?? []).filter((s) => s.exercicio_id === e.id)}
            aberto={estaAberto(e, i)}
            onAlternar={() => setAbertos((a) => ({ ...a, [e.id]: !estaAberto(e, i) }))}
            onMarcar={(s) => void marcar(s)}
            onEditar={() => setEditando(e)}
            onExcluir={() => setExcluindo(e)}
          />
        ))}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.07] px-5 py-3">
          <LinkAcao onClick={() => setAdicionando(true)}>+ exercício</LinkAcao>
          {sessaoAtiva && (
            <button
              type="button"
              onClick={() => void concluirTreino()}
              disabled={finalizarSessao.isPending}
              className="min-h-11 rounded bg-accent3 px-5 text-[14px] font-bold text-[#04201a] disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent3"
            >
              Concluir treino
            </button>
          )}
        </div>
      </>
    );
  }

  return (
    // -mx-4 no celular: as linhas finas vão de ponta a ponta, com a margem de 20px do Caderno dentro de cada seção.
    <div className="-mx-4 max-w-2xl md:mx-0">
      <header className="flex items-end justify-between gap-3 px-5 pb-4 pt-4">
        <h1 className="font-syne text-[30px] font-extrabold leading-none tracking-[-0.5px] text-text">Treino</h1>
        <p className="truncate text-[12px] uppercase tracking-[1.6px] text-muted-text">{contexto}</p>
      </header>

      <div className="border-b border-white/[0.07] px-5 pb-4">
        <SeletorDias dias={dias} selecionado={dia} hoje={hoje} onSelecionar={setDia} />
      </div>

      {conteudo}

      <LembreteTreino
        ligado={lembreteQ.isError ? null : lembreteQ.data}
        salvando={salvarLembrete.isPending}
        onAlterar={(ligado) =>
          salvarLembrete.mutate(ligado, { onError: () => toast.error('Não deu para salvar o lembrete. Tente de novo.') })
        }
      />

      <TimerDescanso
        isOpen={descanso.aberto}
        tempoInicial={descanso.segundos}
        serieAtual={descanso.serie}
        totalSeries={descanso.total}
        proximaSerie={descanso.proxima}
        onComplete={() => setDescanso((d) => ({ ...d, aberto: false }))}
        onSkip={() => setDescanso((d) => ({ ...d, aberto: false }))}
        onClose={() => setDescanso((d) => ({ ...d, aberto: false }))}
      />

      <Modal isOpen={criandoTreino} onClose={() => setCriandoTreino(false)} title={`Treino de ${nomeDia.toLowerCase()}`}>
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            void salvarTreinoNovo();
          }}
        >
          <Input
            label="Nome do treino"
            placeholder="Ex.: Superior A"
            value={nomeTreino}
            onChange={(e) => setNomeTreino(e.target.value)}
            maxLength={100}
            autoFocus
          />
          <div className="flex justify-end gap-3">
            <Button variant="ghost" type="button" onClick={() => setCriandoTreino(false)}>Cancelar</Button>
            <Button type="submit" isLoading={criarTreino.isPending} disabled={!nomeTreino.trim()}>Salvar</Button>
          </div>
        </form>
      </Modal>

      <AddExercicioModal
        key={editando?.id ?? 'novo'}
        isOpen={adicionando || !!editando}
        onClose={() => {
          setAdicionando(false);
          setEditando(null);
        }}
        onSubmit={(data) => void salvarExercicio(data)}
        isLoading={adicionarExercicio.isPending || atualizarExercicio.isPending}
        title={editando ? 'Editar exercício' : 'Adicionar exercício'}
        defaultValues={
          editando
            ? {
                nome: editando.nome,
                series: editando.series,
                repeticoes: editando.repeticoes,
                carga: editando.carga,
                tempo_descanso: editando.tempo_descanso,
                observacao: editando.observacao,
              }
            : undefined
        }
      />

      <ConfirmDialog
        isOpen={!!excluindo}
        onClose={() => setExcluindo(null)}
        onConfirm={() => void confirmarExclusao()}
        title="Excluir exercício"
        message={`Excluir "${excluindo?.nome ?? ''}" e o histórico de cargas dele? Isso não pode ser desfeito.`}
        confirmLabel="Excluir"
        isLoading={excluirExercicio.isPending}
      />
    </div>
  );
}
