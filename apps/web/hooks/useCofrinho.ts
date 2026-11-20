'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useMutacao } from './useMutacao';
import { cofrinhoService } from '@meudia/api';
import type { Competencia } from '@meudia/shared';
import { useAuth } from './useAuth';
import { chavesAfetadasPorLancamento } from '../lib/financas-query-keys';

function requireUserId(userId: string | undefined): string {
  if (!userId) throw new Error('Não autenticado');
  return userId;
}

function useInvalidarPainel() {
  const queryClient = useQueryClient();
  return () => {
    for (const queryKey of chavesAfetadasPorLancamento()) void queryClient.invalidateQueries({ queryKey });
  };
}

type MoverInput = { tipo: 'guardar' | 'tirar'; valor: number; chave?: string };

/** "Guardar no Cofrinho" / "Tirar do Cofrinho": a mesma chave em todos os retries (não soma duas vezes). */
export function useMoverCofrinho() {
  const { user } = useAuth();
  const invalidar = useInvalidarPainel();
  return useMutacao({
    onMutate: (data: MoverInput) => { data.chave = crypto.randomUUID(); },
    mutationFn: (data: MoverInput) => cofrinhoService.moverCofrinho(requireUserId(user?.id), { tipo: data.tipo, valor: data.valor }, data.chave),
    onSuccess: invalidar,
  });
}

type CorrigirInput = { valor_real: number; chave?: string };

export function useCorrigirCofrinho() {
  const { user } = useAuth();
  const invalidar = useInvalidarPainel();
  return useMutacao({
    onMutate: (data: CorrigirInput) => { data.chave = crypto.randomUUID(); },
    mutationFn: (data: CorrigirInput) => cofrinhoService.corrigirCofrinho(requireUserId(user?.id), { valor_real: data.valor_real }, data.chave),
    onSuccess: invalidar,
  });
}

export type FecharMesInput = { competencia: Competencia; guardar: true; valor: number } | { competencia: Competencia; guardar: false };

/** Resposta ao "Sobrou R$ X em <mês>": idempotente no banco (uma por mês). */
export function useFecharMesCofrinho() {
  const { user } = useAuth();
  const invalidar = useInvalidarPainel();
  return useMutacao({
    mutationFn: (data: FecharMesInput) => cofrinhoService.fecharMesCofrinho(requireUserId(user?.id), data),
    // Também no erro: outra aba pode já ter respondido.
    onSettled: invalidar,
  });
}
