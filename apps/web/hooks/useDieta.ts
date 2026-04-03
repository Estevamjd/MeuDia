'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { dietaService } from '@meudia/api';
import type { RefeicaoInsert } from '@meudia/shared';
import { useAuth } from './useAuth';
import { format } from 'date-fns';

export function useRefeicoesDoDia(date?: string) {
  const { user } = useAuth();
  const targetDate = date ?? format(new Date(), 'yyyy-MM-dd');

  return useQuery({
    queryKey: ['refeicoes', user?.id, targetDate],
    queryFn: () => dietaService.refeicoesDoDia(user!.id, targetDate),
    enabled: !!user?.id,
  });
}

export function useCriarRefeicao() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: RefeicaoInsert) => {
      if (!user?.id) throw new Error('Nao autenticado');
      return dietaService.criarRefeicao(user.id, data);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['refeicoes'] });
      void queryClient.invalidateQueries({ queryKey: ['resumo-nutricional'] });
    },
  });
}

export function useAtualizarRefeicao() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<RefeicaoInsert> }) => {
      return dietaService.atualizarRefeicao(id, data);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['refeicoes'] });
      void queryClient.invalidateQueries({ queryKey: ['resumo-nutricional'] });
    },
  });
}

export function useExcluirRefeicao() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => dietaService.excluirRefeicao(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['refeicoes'] });
      void queryClient.invalidateQueries({ queryKey: ['resumo-nutricional'] });
    },
  });
}

export function useAguaHoje(date?: string) {
  const { user } = useAuth();
  const targetDate = date ?? format(new Date(), 'yyyy-MM-dd');

  return useQuery({
    queryKey: ['agua', user?.id, targetDate],
    queryFn: () => dietaService.aguaHoje(user!.id, targetDate),
    enabled: !!user?.id,
  });
}

export function useRegistrarAgua() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (date?: string) => {
      if (!user?.id) throw new Error('Nao autenticado');
      return dietaService.registrarAgua(user.id, date);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['agua'] });
    },
  });
}

export function useHistoricoPeso() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['historico-peso', user?.id],
    queryFn: () => dietaService.historicosPeso(user!.id),
    enabled: !!user?.id,
  });
}

export function useRegistrarPeso() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: { peso: number; data?: string; observacao?: string | null }) => {
      if (!user?.id) throw new Error('Nao autenticado');
      return dietaService.registrarPeso(user.id, data);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['historico-peso'] });
    },
  });
}

export function useResumoNutricional(date?: string) {
  const { user } = useAuth();
  const targetDate = date ?? format(new Date(), 'yyyy-MM-dd');

  return useQuery({
    queryKey: ['resumo-nutricional', user?.id, targetDate],
    queryFn: () => dietaService.resumoNutricionalDia(user!.id, targetDate),
    enabled: !!user?.id,
  });
}
