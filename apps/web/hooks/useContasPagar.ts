'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { contasPagarRepository, contasPagarService } from '@meudia/api';
import type { Competencia, ContaPagarInsert } from '@meudia/shared';
import { useAuth } from './useAuth';
import { chavesAfetadasPorPagamento, contasKeys } from '../lib/financas-query-keys';

interface PagamentoVars {
  contaId: string;
  competencia: Competencia;
}

interface PagarVars extends PagamentoVars {
  pago_em?: string;
  banco?: string | null;
  carteira_id?: string | null;
}

function requireUserId(userId: string | undefined): string {
  if (!userId) throw new Error('Não autenticado');
  return userId;
}

/** Definições de conta ativas (inclui anuais/únicas fora do mês corrente). */
export function useContas() {
  const { user } = useAuth();

  return useQuery({
    queryKey: contasKeys.definicoes(user?.id),
    queryFn: () => contasPagarRepository.findAll(requireUserId(user?.id), { ativo: true }),
    enabled: !!user?.id,
  });
}

export function useContasMes(competencia: Competencia) {
  const { user } = useAuth();

  return useQuery({
    queryKey: contasKeys.mes(user?.id, competencia),
    queryFn: () => contasPagarService.listarContasDoMes(requireUserId(user?.id), competencia),
    enabled: !!user?.id,
  });
}

export function useContaDoMes(id: string, competencia: Competencia) {
  const { user } = useAuth();

  return useQuery({
    queryKey: contasKeys.contaDoMes(user?.id, id, competencia),
    queryFn: () => contasPagarService.obterContaDoMes(requireUserId(user?.id), id, competencia),
    enabled: !!user?.id && !!id,
  });
}

function useInvalidarContas() {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: contasKeys.todas });
    void queryClient.invalidateQueries({ queryKey: contasKeys.contaTodas });
    void queryClient.invalidateQueries({ queryKey: ['resumo-financeiro-mes'] });
  };
}

export function useCriarConta() {
  const { user } = useAuth();
  const invalidar = useInvalidarContas();

  return useMutation({
    mutationFn: (data: ContaPagarInsert) => contasPagarService.criarConta(requireUserId(user?.id), data),
    onSuccess: invalidar,
  });
}

export function useAtualizarConta() {
  const { user } = useAuth();
  const invalidar = useInvalidarContas();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<ContaPagarInsert> }) =>
      contasPagarService.atualizarConta(requireUserId(user?.id), id, data),
    onSuccess: invalidar,
  });
}

/** "Excluir" conta = `ativo=false` (preserva o histórico de pagamentos). */
export function useDesativarConta() {
  const { user } = useAuth();
  const invalidar = useInvalidarContas();

  return useMutation({
    mutationFn: (id: string) => contasPagarService.desativarConta(requireUserId(user?.id), id),
    onSuccess: invalidar,
  });
}

function useInvalidarPagamento() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  return ({ contaId, competencia }: PagamentoVars) => {
    for (const queryKey of chavesAfetadasPorPagamento(user?.id, contaId, competencia)) {
      void queryClient.invalidateQueries({ queryKey });
    }
  };
}

export function usePagarConta() {
  const { user } = useAuth();
  const invalidar = useInvalidarPagamento();

  return useMutation({
    mutationFn: ({ contaId, competencia, pago_em, banco, carteira_id }: PagarVars) =>
      contasPagarService.pagarConta(requireUserId(user?.id), contaId, { competencia, pago_em, banco, carteira_id }),
    // Também no erro: 409 "já paga" (outra aba/aparelho) precisa refletir o estado real.
    onSettled: (_data, _error, vars) => invalidar(vars),
  });
}

export function useDesfazerPagamento() {
  const { user } = useAuth();
  const invalidar = useInvalidarPagamento();

  return useMutation({
    mutationFn: ({ contaId, competencia }: PagamentoVars) =>
      contasPagarService.desfazerPagamento(requireUserId(user?.id), contaId, competencia),
    onSettled: (_data, _error, vars) => invalidar(vars),
  });
}
