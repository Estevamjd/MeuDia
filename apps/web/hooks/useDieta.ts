'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useMutacao } from './useMutacao';
import { dietaService } from '@meudia/api';
import type { RefeicaoInsert } from '@meudia/shared';
import { useAuth } from './useAuth';
import { hojeSP } from '../lib/hoje';

export function useRefeicoesDoDia(date?: string) {
  const { user } = useAuth();
  const targetDate = date ?? hojeSP();

  return useQuery({
    queryKey: ['refeicoes', user?.id, targetDate],
    queryFn: () => dietaService.refeicoesDoDia(user!.id, targetDate),
    enabled: !!user?.id,
  });
}

export function useCriarRefeicao() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutacao({
    mutationFn: (data: RefeicaoInsert) => {
      if (!user?.id) throw new Error('Nao autenticado');
      return dietaService.criarRefeicao(user.id, data);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['refeicoes'] });
    },
  });
}

export function useAtualizarRefeicao() {
  const queryClient = useQueryClient();

  return useMutacao({
    mutationFn: ({ id, data }: { id: string; data: Partial<RefeicaoInsert> }) => {
      return dietaService.atualizarRefeicao(id, data);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['refeicoes'] });
    },
  });
}

export function useExcluirRefeicao() {
  const queryClient = useQueryClient();

  return useMutacao({
    mutationFn: (id: string) => dietaService.excluirRefeicao(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['refeicoes'] });
    },
  });
}
