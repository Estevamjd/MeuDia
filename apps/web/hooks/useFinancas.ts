'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { financasService } from '@meudia/api';
import type { TransacaoInsert, UUID } from '@meudia/shared';
import { useAuth } from './useAuth';
import { chavesAfetadasPorLancamento } from '../lib/financas-query-keys';
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

/**
 * Lançamentos de uma faixa de datas numa consulta só (paginada por chave no repositório). Fica sob o prefixo
 * `transacoes-mes` para herdar as invalidações de `chavesAfetadasPorLancamento`/`chavesAfetadasPorPagamento`.
 */
export function useTransacoesFaixa(inicio: string, fim: string) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['transacoes-mes', user?.id, 'faixa', inicio, fim],
    queryFn: () => financasService.transacoesEntre(user!.id, inicio, fim),
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
      for (const queryKey of chavesAfetadasPorLancamento()) void queryClient.invalidateQueries({ queryKey });
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
      for (const queryKey of chavesAfetadasPorLancamento()) void queryClient.invalidateQueries({ queryKey });
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
      for (const queryKey of chavesAfetadasPorLancamento()) void queryClient.invalidateQueries({ queryKey });
    },
  });
}

export interface DespesaParceladaInput {
  /** Dados comuns às parcelas (tipo despesa, categoria, descrição, banco, data da 1ª). */
  base: TransacaoInsert;
  /** Valor TOTAL da compra; a divisão em centavos é do service (`dividirParcelas`). */
  total: number;
  parcelas: number;
}

/** Compra parcelada no cartão: N despesas num insert só (tudo ou nada). Sem fila offline (lote atômico). */
export function useCriarDespesaParcelada() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: DespesaParceladaInput) => {
      if (!user?.id) throw new Error('Não autenticado');
      return financasService.criarDespesaParcelada(user.id, input);
    },
    onSuccess: () => {
      for (const queryKey of chavesAfetadasPorLancamento()) void queryClient.invalidateQueries({ queryKey });
    },
  });
}

/** "Esta e as próximas": apaga as parcelas do grupo a partir de `aPartirDe` (inclusive). */
export function useExcluirParcelasDesde() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ grupo, aPartirDe }: { grupo: UUID; aPartirDe: number }) => {
      if (!user?.id) throw new Error('Não autenticado');
      return financasService.excluirParcelasDesde(user.id, grupo, aPartirDe);
    },
    onSuccess: () => {
      for (const queryKey of chavesAfetadasPorLancamento()) void queryClient.invalidateQueries({ queryKey });
    },
  });
}

export function useVinculosTransacoes(ids: string[]) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['vinculos-transacoes', user?.id, ids],
    queryFn: () => financasService.vinculosTransacoes(user!.id, ids),
    enabled: !!user?.id && ids.length > 0,
  });
}
