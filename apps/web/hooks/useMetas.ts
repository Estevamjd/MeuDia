'use client';

import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { metasService } from '@meudia/api';
import type { MetaInsert, SobraDoMes } from '@meudia/shared';
import { competenciaDe, sobraDoMes } from '@meudia/shared';
import { useAuth } from './useAuth';
import { usePainelSaldo } from './useCarteiras';
import { useTransacoesMes } from './useFinancas';
import { metasKeys } from '../lib/financas-query-keys';

function requireUserId(userId: string | undefined): string {
  if (!userId) throw new Error('Não autenticado');
  return userId;
}

function useInvalidarMetas() {
  const queryClient = useQueryClient();
  return () => void queryClient.invalidateQueries({ queryKey: metasKeys.todas });
}

export function useMetas() {
  const { user } = useAuth();
  return useQuery({
    queryKey: metasKeys.lista(user?.id),
    queryFn: () => metasService.listarMetas(requireUserId(user?.id)),
    enabled: !!user?.id,
  });
}

export function useCriarMeta() {
  const { user } = useAuth();
  const invalidar = useInvalidarMetas();
  return useMutation({
    mutationFn: (data: MetaInsert) => metasService.criarMeta(requireUserId(user?.id), data),
    onSuccess: invalidar,
  });
}

/** Editar ou corrigir o valor guardado (absoluto). */
export function useAtualizarMeta() {
  const { user } = useAuth();
  const invalidar = useInvalidarMetas();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<MetaInsert> & { valor_guardado?: number } }) =>
      metasService.atualizarMeta(requireUserId(user?.id), id, data),
    onSuccess: invalidar,
  });
}

/** "Guardei": soma no banco (RPC atômica). */
export function useGuardarNaMeta() {
  const { user } = useAuth();
  const invalidar = useInvalidarMetas();
  return useMutation({
    mutationFn: ({ id, valor }: { id: string; valor: number }) => metasService.guardar(requireUserId(user?.id), id, valor),
    onSettled: invalidar,
  });
}

export function useExcluirMeta() {
  const { user } = useAuth();
  const invalidar = useInvalidarMetas();
  return useMutation({
    mutationFn: (id: string) => metasService.excluirMeta(requireUserId(user?.id), id),
    onSuccess: invalidar,
  });
}

/**
 * "No fim do mês sobra" do mês corrente, a mesma conta do Início (`sobraDoMes` com o painel e os lançamentos do mês).
 * Diferente do card do Início, não exige banco cadastrado: a sobra não usa saldo.
 */
export function useSobraDoMesCorrente(hojeISO: string): { sobra: SobraDoMes | null; carregando: boolean; erro: boolean } {
  const painel = usePainelSaldo(hojeISO);
  const competencia = competenciaDe(hojeISO);
  const [ano, mes] = competencia.split('-').map(Number) as [number, number];
  const transacoes = useTransacoesMes(ano, mes);
  const sobra = useMemo(
    () => (painel.data && transacoes.data ? sobraDoMes({ competencia, transacoes: transacoes.data, ...painel.data.mes }) : null),
    [competencia, painel.data, transacoes.data],
  );
  return { sobra, carregando: painel.isLoading || transacoes.isLoading, erro: painel.isError || transacoes.isError };
}
