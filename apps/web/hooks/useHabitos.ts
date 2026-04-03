'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { habitoService } from '@meudia/api';
import type { HabitoInsert } from '@meudia/shared';
import { useAuth } from './useAuth';
import { withOfflineSupport } from '../lib/offline-mutation';

export function useHabitos() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['habitos', user?.id],
    queryFn: () => habitoService.listarHabitos(user!.id),
    enabled: !!user?.id,
  });
}

export function useCriarHabito() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: withOfflineSupport(
      'habito:criar',
      (data: HabitoInsert) => {
        if (!user?.id) throw new Error('Não autenticado');
        return habitoService.criarHabito(user.id, data);
      },
      (data) => {
        if (!user?.id) throw new Error('Não autenticado');
        return { userId: user.id, data };
      },
    ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['habitos'] });
    },
  });
}

export function useAtualizarHabito() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: withOfflineSupport(
      'habito:atualizar',
      ({ id, data }: { id: string; data: Partial<HabitoInsert> }) => {
        if (!user?.id) throw new Error('Não autenticado');
        return habitoService.atualizarHabito(user.id, id, data);
      },
      ({ id, data }) => ({ userId: user?.id, id, data }),
    ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['habitos'] });
    },
  });
}

export function useExcluirHabito() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: withOfflineSupport(
      'habito:excluir',
      (id: string) => {
        if (!user?.id) throw new Error('Não autenticado');
        return habitoService.excluirHabito(user.id, id);
      },
      (id) => ({ userId: user?.id, id }),
    ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['habitos'] });
    },
  });
}

export function useRegistrosHoje() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['registros-hoje', user?.id],
    queryFn: () => habitoService.obterRegistrosHoje(user!.id),
    enabled: !!user?.id,
    staleTime: 1000 * 60,
  });
}

export function useRegistrosSemana() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['registros-semana', user?.id],
    queryFn: () => habitoService.obterRegistrosSemana(user!.id),
    enabled: !!user?.id,
  });
}

export function useMarcarHabito() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: withOfflineSupport(
      'habito:marcar',
      ({
        habitoId,
        data,
        concluido,
        valor,
      }: {
        habitoId: string;
        data: string;
        concluido: boolean;
        valor: number;
      }) => {
        if (!user?.id) throw new Error('Não autenticado');
        return habitoService.marcarHabito(user.id, habitoId, data, concluido, valor);
      },
      ({ habitoId, data, concluido, valor }) => {
        if (!user?.id) throw new Error('Não autenticado');
        return {
          userId: user.id,
          habitoId,
          date: data,
          concluido,
          valor,
        };
      },
    ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['registros-hoje'] });
      void queryClient.invalidateQueries({ queryKey: ['registros-semana'] });
      void queryClient.invalidateQueries({ queryKey: ['score'] });
    },
  });
}
