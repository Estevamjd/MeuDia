'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { treinoService } from '@meudia/api';
import type { TreinoInsert, ExercicioInsert, SerieRealizadaInsert } from '@meudia/shared';
import { useAuth } from './useAuth';
import { withOfflineSupport } from '../lib/offline-mutation';

export function useTreinos() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['treinos', user?.id],
    queryFn: () => treinoService.listarTreinos(user!.id),
    enabled: !!user?.id,
  });
}

export function useTreino(treinoId: string | undefined) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['treino', treinoId],
    queryFn: () => treinoService.obterTreino(user!.id, treinoId!),
    enabled: !!treinoId && !!user?.id,
  });
}

export function useCriarTreino() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: withOfflineSupport(
      'treino:criar',
      (data: TreinoInsert) => {
        if (!user?.id) throw new Error('Não autenticado');
        return treinoService.criarTreino(user.id, data);
      },
      (data) => {
        if (!user?.id) throw new Error('Não autenticado');
        return { userId: user.id, data };
      },
    ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['treinos'] });
    },
  });
}

export function useAtualizarTreino() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: withOfflineSupport(
      'treino:atualizar',
      ({ id, data }: { id: string; data: Partial<TreinoInsert> }) => {
        if (!user?.id) throw new Error('Não autenticado');
        return treinoService.atualizarTreino(user.id, id, data);
      },
      ({ id, data }) => ({ userId: user?.id, id, data }),
    ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['treinos'] });
    },
  });
}

export function useExcluirTreino() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: withOfflineSupport(
      'treino:excluir',
      (id: string) => {
        if (!user?.id) throw new Error('Não autenticado');
        return treinoService.excluirTreino(user.id, id);
      },
      (id) => ({ userId: user?.id, id }),
    ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['treinos'] });
    },
  });
}

export function useAdicionarExercicio() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: ExercicioInsert) => treinoService.adicionarExercicio(data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['treinos'] });
    },
  });
}

export function useAtualizarExercicio() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<ExercicioInsert> }) =>
      treinoService.atualizarExercicio(id, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['treinos'] });
    },
  });
}

export function useExcluirExercicio() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => treinoService.excluirExercicio(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['treinos'] });
    },
  });
}

export function useReordenarExercicios() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (exercicios: { id: string; ordem: number }[]) =>
      treinoService.reordenarExercicios(exercicios),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['treinos'] });
    },
  });
}

// === Sessões ===

export function useSessoesSemana() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['sessoes-semana', user?.id],
    queryFn: () => treinoService.obterSessoesSemana(user!.id),
    enabled: !!user?.id,
  });
}

export function useSeriesDaSessao(sessaoId: string | undefined) {
  return useQuery({
    queryKey: ['series', sessaoId],
    queryFn: () => treinoService.obterSeriesDaSessao(sessaoId!),
    enabled: !!sessaoId,
  });
}

export function useHistoricoExercicio(exercicioId: string | undefined) {
  return useQuery({
    queryKey: ['historico-exercicio', exercicioId],
    queryFn: () => treinoService.obterHistoricoExercicio(exercicioId!),
    enabled: !!exercicioId,
    staleTime: 5 * 60 * 1000,
  });
}

export function useIniciarSessao() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (treinoId: string) => {
      if (!user?.id) throw new Error('Não autenticado');
      return treinoService.iniciarSessao(user.id, treinoId);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['sessoes-semana'] });
    },
  });
}

export function useFinalizarSessao() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ sessaoId, duracao }: { sessaoId: string; duracao: number }) =>
      treinoService.finalizarSessao(sessaoId, duracao),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['sessoes-semana'] });
      void queryClient.invalidateQueries({ queryKey: ['score'] });
    },
  });
}

export function useRegistrarSerie() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: withOfflineSupport<SerieRealizadaInsert, unknown>(
      'treino:registrar-serie',
      (data) => treinoService.registrarSerie(data),
      (data) => ({ data }),
    ),
    onSuccess: (_, variables: SerieRealizadaInsert) => {
      void queryClient.invalidateQueries({ queryKey: ['series', variables.sessao_id] });
    },
  });
}

export function useAtualizarSerie() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<SerieRealizadaInsert> }) =>
      treinoService.atualizarSerie(id, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['series'] });
    },
  });
}
