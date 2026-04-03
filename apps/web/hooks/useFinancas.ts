'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { financasService } from '@meudia/api';
import type { TransacaoInsert } from '@meudia/shared';
import { useAuth } from './useAuth';
import { withOfflineSupport } from '../lib/offline-mutation';

export function useTransacoes() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['transacoes', user?.id],
    queryFn: () => financasService.listarTransacoes(user!.id),
    enabled: !!user?.id,
  });
}

export function useTransacoesMes(ano: number, mes: number) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['transacoes-mes', user?.id, ano, mes],
    queryFn: () => financasService.transacoesDoMes(user!.id, ano, mes),
    enabled: !!user?.id,
  });
}

export function useResumoMensal(ano: number, mes: number) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['resumo-mensal', user?.id, ano, mes],
    queryFn: () => financasService.resumoMensal(user!.id, ano, mes),
    enabled: !!user?.id,
  });
}

export function useCriarTransacao() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: withOfflineSupport(
      'financas:criar',
      (data: TransacaoInsert) => {
        if (!user?.id) throw new Error('Não autenticado');
        return financasService.criarTransacao(user.id, data);
      },
      (data) => {
        if (!user?.id) throw new Error('Não autenticado');
        return { userId: user.id, data };
      },
    ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['transacoes'] });
      void queryClient.invalidateQueries({ queryKey: ['transacoes-mes'] });
      void queryClient.invalidateQueries({ queryKey: ['resumo-mensal'] });
    },
  });
}

export function useAtualizarTransacao() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: withOfflineSupport(
      'financas:atualizar',
      ({ id, data }: { id: string; data: Partial<TransacaoInsert> }) => {
        if (!user?.id) throw new Error('Não autenticado');
        return financasService.atualizarTransacao(user.id, id, data);
      },
      ({ id, data }) => ({ userId: user?.id, id, data }),
    ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['transacoes'] });
      void queryClient.invalidateQueries({ queryKey: ['transacoes-mes'] });
      void queryClient.invalidateQueries({ queryKey: ['resumo-mensal'] });
    },
  });
}

export function useExcluirTransacao() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: withOfflineSupport(
      'financas:excluir',
      (id: string) => {
        if (!user?.id) throw new Error('Não autenticado');
        return financasService.excluirTransacao(user.id, id);
      },
      (id) => ({ userId: user?.id, id }),
    ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['transacoes'] });
      void queryClient.invalidateQueries({ queryKey: ['transacoes-mes'] });
      void queryClient.invalidateQueries({ queryKey: ['resumo-mensal'] });
    },
  });
}
