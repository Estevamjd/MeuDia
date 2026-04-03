'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { agendaService } from '@meudia/api';
import type { CompromissoInsert } from '@meudia/shared';
import { useAuth } from './useAuth';
import { withOfflineSupport } from '../lib/offline-mutation';

const STALE_TIME = 5 * 60 * 1000;

export function useCompromissos() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['compromissos', user?.id],
    queryFn: () => agendaService.listarCompromissos(user!.id),
    enabled: !!user?.id,
    staleTime: STALE_TIME,
  });
}

export function useCompromissosHoje() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['compromissos-hoje', user?.id],
    queryFn: () => agendaService.compromissosHoje(user!.id),
    enabled: !!user?.id,
    staleTime: STALE_TIME,
  });
}

export function useCompromissosPorData(date: string) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['compromissos', user?.id, date],
    queryFn: () => agendaService.compromissosPorData(user!.id, date),
    enabled: !!user?.id && !!date,
    staleTime: STALE_TIME,
  });
}

export function useCriarCompromisso() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: withOfflineSupport(
      'agenda:criar',
      (data: CompromissoInsert) => {
        if (!user?.id) throw new Error('Não autenticado');
        return agendaService.criarCompromisso(user.id, data);
      },
      (data) => {
        if (!user?.id) throw new Error('Não autenticado');
        return { userId: user.id, data };
      },
    ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['compromissos'] });
      void queryClient.invalidateQueries({ queryKey: ['compromissos-hoje'] });
    },
  });
}

export function useAtualizarCompromisso() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: withOfflineSupport(
      'agenda:atualizar',
      ({ id, data }: { id: string; data: Partial<CompromissoInsert> }) => {
        if (!user?.id) throw new Error('Não autenticado');
        return agendaService.atualizarCompromisso(user.id, id, data);
      },
      ({ id, data }) => ({ userId: user?.id, id, data }),
    ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['compromissos'] });
      void queryClient.invalidateQueries({ queryKey: ['compromissos-hoje'] });
    },
  });
}

export function useExcluirCompromisso() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: withOfflineSupport(
      'agenda:excluir',
      (id: string) => {
        if (!user?.id) throw new Error('Não autenticado');
        return agendaService.excluirCompromisso(user.id, id);
      },
      (id) => ({ userId: user?.id, id }),
    ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['compromissos'] });
      void queryClient.invalidateQueries({ queryKey: ['compromissos-hoje'] });
    },
  });
}

export function useMarcarConcluido() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: withOfflineSupport(
      'agenda:concluir',
      ({ id, concluido }: { id: string; concluido: boolean }) => {
        if (!user?.id) throw new Error('Não autenticado');
        return agendaService.atualizarCompromisso(user.id, id, { concluido });
      },
      ({ id, concluido }) => ({ userId: user?.id, id, concluido }),
    ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['compromissos'] });
      void queryClient.invalidateQueries({ queryKey: ['compromissos-hoje'] });
    },
  });
}
