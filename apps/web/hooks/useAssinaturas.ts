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

/**
 * Assinatura espelha uma conta (contas_pagar): criar/editar/excluir muda contas do mês,
 * resumo e selo. Invalida em `onSettled` porque o espelho pode ter mudado mesmo se a
 * mutação falhar no meio (R5-5).
 */
function useInvalidarAssinaturas() {
  const queryClient = useQueryClient();
  return () => {
    for (const queryKey of assinaturasService.ASSINATURA_INVALIDACOES) void queryClient.invalidateQueries({ queryKey });
  };
}

export function useCriarAssinatura() {
  const { user } = useAuth();
  const invalidar = useInvalidarAssinaturas();

  return useMutation({
    mutationFn: (data: AssinaturaInsert) => assinaturasService.criarAssinatura(user!.id, data),
    onSettled: invalidar,
  });
}

export function useAtualizarAssinatura() {
  const { user } = useAuth();
  const invalidar = useInvalidarAssinaturas();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<AssinaturaInsert> }) =>
      assinaturasService.atualizarAssinatura(user!.id, id, data),
    onSettled: invalidar,
  });
}

export function useExcluirAssinatura() {
  const { user } = useAuth();
  const invalidar = useInvalidarAssinaturas();

  return useMutation({
    mutationFn: (id: string) => assinaturasService.excluirAssinatura(user!.id, id),
    onSettled: invalidar,
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
