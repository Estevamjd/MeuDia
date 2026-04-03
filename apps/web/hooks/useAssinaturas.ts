'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { assinaturasService } from '@meudia/api';
import type { AssinaturaInsert } from '@meudia/shared';
import { useAuth } from './useAuth';

export function useAssinaturas() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['assinaturas', user?.id],
    queryFn: () => assinaturasService.listarAssinaturas(user!.id),
    enabled: !!user?.id,
  });
}

export function useCriarAssinatura() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: AssinaturaInsert) => assinaturasService.criarAssinatura(user!.id, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['assinaturas'] });
      void queryClient.invalidateQueries({ queryKey: ['total-mensal'] });
    },
  });
}

export function useAtualizarAssinatura() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<AssinaturaInsert> }) =>
      assinaturasService.atualizarAssinatura(id, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['assinaturas'] });
      void queryClient.invalidateQueries({ queryKey: ['total-mensal'] });
    },
  });
}

export function useExcluirAssinatura() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => assinaturasService.excluirAssinatura(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['assinaturas'] });
      void queryClient.invalidateQueries({ queryKey: ['total-mensal'] });
    },
  });
}

export function useTotalMensal() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['total-mensal', user?.id],
    queryFn: () => assinaturasService.totalMensal(user!.id),
    enabled: !!user?.id,
  });
}
