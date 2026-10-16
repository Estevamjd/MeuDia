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
      for (const queryKey of assinaturasService.ASSINATURA_INVALIDACOES) void queryClient.invalidateQueries({ queryKey });
    },
  });
}

export function useAtualizarAssinatura() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<AssinaturaInsert> }) =>
      assinaturasService.atualizarAssinatura(user!.id, id, data),
    onSuccess: () => {
      for (const queryKey of assinaturasService.ASSINATURA_INVALIDACOES) void queryClient.invalidateQueries({ queryKey });
    },
  });
}

export function useExcluirAssinatura() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => assinaturasService.excluirAssinatura(user!.id, id),
    onSuccess: () => {
      for (const queryKey of assinaturasService.ASSINATURA_INVALIDACOES) void queryClient.invalidateQueries({ queryKey });
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
