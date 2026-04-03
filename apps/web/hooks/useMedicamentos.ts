'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { medicamentosService } from '@meudia/api';
import { useAuth } from './useAuth';

interface MedicamentoInsert {
  nome: string;
  dosagem: string;
  frequencia: string;
  horarios: string[];
  estoque_atual?: number;
  estoque_minimo?: number;
}

export function useMedicamentos() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['medicamentos', user?.id],
    queryFn: () => medicamentosService.listarMedicamentos(user!.id),
    enabled: !!user?.id,
  });
}

export function useMedicamentosHoje() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['medicamentos-hoje', user?.id],
    queryFn: () => medicamentosService.medicamentosHoje(user!.id),
    enabled: !!user?.id,
  });
}

export function useCriarMedicamento() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: MedicamentoInsert) => {
      if (!user?.id) throw new Error('Nao autenticado');
      return medicamentosService.criarMedicamento(user.id, data);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['medicamentos'] });
      void queryClient.invalidateQueries({ queryKey: ['medicamentos-hoje'] });
    },
  });
}

export function useAtualizarMedicamento() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<MedicamentoInsert> }) => {
      return medicamentosService.atualizarMedicamento(id, data);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['medicamentos'] });
      void queryClient.invalidateQueries({ queryKey: ['medicamentos-hoje'] });
    },
  });
}

export function useExcluirMedicamento() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => medicamentosService.excluirMedicamento(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['medicamentos'] });
      void queryClient.invalidateQueries({ queryKey: ['medicamentos-hoje'] });
    },
  });
}

export function useRegistrarTomado() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (medicamentoId: string) => {
      if (!user?.id) throw new Error('Nao autenticado');
      return medicamentosService.registrarTomado(user.id, medicamentoId);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['medicamentos'] });
      void queryClient.invalidateQueries({ queryKey: ['medicamentos-hoje'] });
    },
  });
}

export function useEstoqueBaixo() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['estoque-baixo', user?.id],
    queryFn: () => medicamentosService.verificarEstoqueBaixo(user!.id),
    enabled: !!user?.id,
  });
}
