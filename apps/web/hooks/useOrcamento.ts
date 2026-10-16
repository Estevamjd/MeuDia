'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { orcamentoService } from '@meudia/api';
import type { OrcamentoCategoria, Renda } from '@meudia/shared';
import { useAuth } from './useAuth';
import { chavesAfetadasPorOrcamento, orcamentoKeys, rendasKeys, resumoKeys } from '../lib/financas-query-keys';

export interface RendaInput {
  descricao: string;
  valor: number;
  dia_recebimento?: number | null;
  ativo?: boolean;
}

export interface OrcamentoInput {
  categoria: string;
  valor_planejado: number;
}

export type ResumoFinanceiroMes = Awaited<ReturnType<typeof orcamentoService.resumoFinanceiroMes>>;

function requireUserId(userId: string | undefined): string {
  if (!userId) throw new Error('Não autenticado');
  return userId;
}

function useInvalidarOrcamento() {
  const queryClient = useQueryClient();
  return () => {
    for (const queryKey of chavesAfetadasPorOrcamento()) void queryClient.invalidateQueries({ queryKey });
  };
}

export function useResumoFinanceiroMes(ano: number, mes: number) {
  const { user } = useAuth();

  return useQuery({
    queryKey: resumoKeys.mes(user?.id, ano, mes),
    queryFn: () => orcamentoService.resumoFinanceiroMes(requireUserId(user?.id), ano, mes),
    enabled: !!user?.id,
  });
}

export function useRendas() {
  const { user } = useAuth();

  return useQuery({
    queryKey: rendasKeys.lista(user?.id),
    queryFn: (): Promise<Renda[]> => orcamentoService.listarRendas(requireUserId(user?.id)),
    enabled: !!user?.id,
  });
}

export function useCriarRenda() {
  const { user } = useAuth();
  const invalidar = useInvalidarOrcamento();

  return useMutation({
    mutationFn: (data: RendaInput) => orcamentoService.criarRenda(requireUserId(user?.id), data),
    onSuccess: invalidar,
  });
}

export function useAtualizarRenda() {
  const { user } = useAuth();
  const invalidar = useInvalidarOrcamento();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<RendaInput> }) =>
      orcamentoService.atualizarRenda(requireUserId(user?.id), id, data),
    onSuccess: invalidar,
  });
}

export function useExcluirRenda() {
  const { user } = useAuth();
  const invalidar = useInvalidarOrcamento();

  return useMutation({
    mutationFn: (id: string) => orcamentoService.excluirRenda(requireUserId(user?.id), id),
    onSuccess: invalidar,
  });
}

export function useOrcamento() {
  const { user } = useAuth();

  return useQuery({
    queryKey: orcamentoKeys.lista(user?.id),
    queryFn: (): Promise<OrcamentoCategoria[]> => orcamentoService.listarOrcamento(requireUserId(user?.id)),
    enabled: !!user?.id,
  });
}

/** Upsert por categoria (UNIQUE user_id, categoria). */
export function useSalvarOrcamento() {
  const { user } = useAuth();
  const invalidar = useInvalidarOrcamento();

  return useMutation({
    mutationFn: (data: OrcamentoInput) => orcamentoService.salvarOrcamento(requireUserId(user?.id), data),
    onSuccess: invalidar,
  });
}

export function useExcluirOrcamento() {
  const { user } = useAuth();
  const invalidar = useInvalidarOrcamento();

  return useMutation({
    mutationFn: (id: string) => orcamentoService.excluirOrcamento(requireUserId(user?.id), id),
    onSuccess: invalidar,
  });
}
