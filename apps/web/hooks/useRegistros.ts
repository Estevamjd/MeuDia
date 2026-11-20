'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useMutacao } from './useMutacao';
import { registrosService } from '@meudia/api';
import type { RegistroRefeicaoInsert, RegistroTreinoInsert } from '@meudia/shared';
import { useAuth } from './useAuth';

function requireUserId(userId: string | undefined): string {
  if (!userId) throw new Error('Não autenticado');
  return userId;
}

export const registrosKeys = {
  treinos: (userId: string | undefined, desde: string) => ['registros-treino', userId, desde] as const,
  refeicoes: (userId: string | undefined, desde: string) => ['registros-refeicao', userId, desde] as const,
};

/** Treinos rápidos desde `desdeISO` (inclui os que chegam pelo WhatsApp). */
export function useRegistrosTreino(desdeISO: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: registrosKeys.treinos(user?.id, desdeISO),
    queryFn: () => registrosService.listarTreinos(requireUserId(user?.id), desdeISO),
    enabled: !!user?.id,
  });
}

export function useRegistrosRefeicao(desdeISO: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: registrosKeys.refeicoes(user?.id, desdeISO),
    queryFn: () => registrosService.listarRefeicoes(requireUserId(user?.id), desdeISO),
    enabled: !!user?.id,
  });
}

function useInvalidar(prefixo: 'registros-treino' | 'registros-refeicao') {
  const qc = useQueryClient();
  return () => void qc.invalidateQueries({ queryKey: [prefixo] });
}

export function useRegistrarTreino() {
  const { user } = useAuth();
  const invalidar = useInvalidar('registros-treino');
  return useMutacao({
    mutationFn: (data: RegistroTreinoInsert) => registrosService.registrarTreino(requireUserId(user?.id), data),
    onSuccess: invalidar,
  });
}

export function useExcluirRegistroTreino() {
  const { user } = useAuth();
  const invalidar = useInvalidar('registros-treino');
  return useMutacao({
    mutationFn: (id: string) => registrosService.excluirTreino(requireUserId(user?.id), id),
    onSuccess: invalidar,
  });
}

export function useRegistrarRefeicao() {
  const { user } = useAuth();
  const invalidar = useInvalidar('registros-refeicao');
  return useMutacao({
    mutationFn: (data: RegistroRefeicaoInsert) => registrosService.registrarRefeicao(requireUserId(user?.id), data),
    onSuccess: invalidar,
  });
}

export function useExcluirRegistroRefeicao() {
  const { user } = useAuth();
  const invalidar = useInvalidar('registros-refeicao');
  return useMutacao({
    mutationFn: (id: string) => registrosService.excluirRefeicao(requireUserId(user?.id), id),
    onSuccess: invalidar,
  });
}
