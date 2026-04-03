'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { veiculoService } from '@meudia/api';
import type { VeiculoInsert, ManutencaoInsert } from '@meudia/shared';
import { useAuth } from './useAuth';
import { withOfflineSupport } from '../lib/offline-mutation';

export function useVeiculos() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['veiculos', user?.id],
    queryFn: () => veiculoService.listarVeiculos(user!.id),
    enabled: !!user?.id,
  });
}

export function useCriarVeiculo() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: withOfflineSupport(
      'veiculo:criar',
      (data: VeiculoInsert) => {
        if (!user?.id) throw new Error('Não autenticado');
        return veiculoService.criarVeiculo(user.id, data);
      },
      (data) => {
        if (!user?.id) throw new Error('Não autenticado');
        return { userId: user.id, data };
      },
    ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['veiculos'] });
    },
  });
}

export function useAtualizarVeiculo() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: withOfflineSupport(
      'veiculo:atualizar',
      ({ id, data }: { id: string; data: Partial<VeiculoInsert> }) =>
        veiculoService.atualizarVeiculo(id, data),
      ({ id, data }) => ({ id, data }),
    ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['veiculos'] });
    },
  });
}

export function useExcluirVeiculo() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: withOfflineSupport(
      'veiculo:excluir',
      (id: string) => veiculoService.excluirVeiculo(id),
      (id) => ({ id }),
    ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['veiculos'] });
    },
  });
}

export function useManutencoes(veiculoId: string | undefined) {
  return useQuery({
    queryKey: ['manutencoes', veiculoId],
    queryFn: () => veiculoService.listarManutencoes(veiculoId!),
    enabled: !!veiculoId,
  });
}

export function useCriarManutencao() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: withOfflineSupport<ManutencaoInsert, unknown>(
      'veiculo:criar-manutencao',
      (data) => veiculoService.criarManutencao(data),
      (data) => ({ data }),
    ),
    onSuccess: (_, variables: ManutencaoInsert) => {
      void queryClient.invalidateQueries({ queryKey: ['manutencoes', variables.veiculo_id] });
    },
  });
}

export function useExcluirManutencao() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: withOfflineSupport<{ id: string; veiculoId: string }, unknown>(
      'veiculo:excluir-manutencao',
      ({ id }) => veiculoService.excluirManutencao(id),
      ({ id }) => ({ id }),
    ),
    onSuccess: (_, variables: { id: string; veiculoId: string }) => {
      void queryClient.invalidateQueries({ queryKey: ['manutencoes', variables.veiculoId] });
    },
  });
}
