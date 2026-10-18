'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { carteirasService } from '@meudia/api';
import type { CarteiraInsert, Competencia, TipoCarteira } from '@meudia/shared';
import { useAuth } from './useAuth';
import { carteirasKeys, chavesAfetadasPorLancamento } from '../lib/financas-query-keys';

function requireUserId(userId: string | undefined): string {
  if (!userId) throw new Error('Não autenticado');
  return userId;
}

function useInvalidarSaldo() {
  const queryClient = useQueryClient();
  return () => {
    for (const queryKey of chavesAfetadasPorLancamento()) void queryClient.invalidateQueries({ queryKey });
  };
}

/** Todas as carteiras (inclusive arquivadas). */
export function useCarteiras() {
  const { user } = useAuth();
  return useQuery({
    queryKey: carteirasKeys.lista(user?.id),
    queryFn: () => carteirasService.listarCarteiras(requireUserId(user?.id)),
    enabled: !!user?.id,
  });
}

/** Cofrinho (saldo de hoje), chips, entradas da sobra do mês, "Começou o mês com" e rendas a receber. */
export function usePainelSaldo(hojeISO: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: carteirasKeys.painel(user?.id, hojeISO),
    queryFn: () => carteirasService.painelSaldo(requireUserId(user?.id), hojeISO),
    enabled: !!user?.id,
  });
}

export function useCriarCarteira() {
  const { user } = useAuth();
  const invalidar = useInvalidarSaldo();
  return useMutation({
    mutationFn: (data: CarteiraInsert) => carteirasService.criarCarteira(requireUserId(user?.id), data),
    onSuccess: invalidar,
  });
}

export interface CarteiraPatch {
  nome?: string;
  tipo?: TipoCarteira;
  incluir_no_total?: boolean;
  arquivada?: boolean;
}

export function useAtualizarCarteira() {
  const { user } = useAuth();
  const invalidar = useInvalidarSaldo();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: CarteiraPatch }) =>
      carteirasService.atualizarCarteira(requireUserId(user?.id), id, data),
    onSuccess: invalidar,
  });
}

/** Excluir banco (007): lançamentos/rendas viram "Sem banco"; o saldo dos demais bancos não muda. */
export function useExcluirCarteira() {
  const { user } = useAuth();
  const invalidar = useInvalidarSaldo();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => carteirasService.excluirCarteira(requireUserId(user?.id), id),
    onSuccess: () => {
      invalidar();
      // A renda pode ter perdido a carteira padrão.
      void queryClient.invalidateQueries({ queryKey: ['rendas'] });
    },
  });
}

export function useExcluirTransferencia() {
  const { user } = useAuth();
  const invalidar = useInvalidarSaldo();
  return useMutation({
    mutationFn: (id: string) => carteirasService.excluirTransferencia(requireUserId(user?.id), id),
    onSuccess: invalidar,
  });
}

export interface GasteiInput {
  valor: number;
  categoria: string;
  descricao?: string;
  carteira_id: string;
  data: string;
}

export function useGastei(hojeISO: string) {
  const { user } = useAuth();
  const invalidar = useInvalidarSaldo();
  return useMutation({
    mutationFn: (data: GasteiInput) => carteirasService.gastei(requireUserId(user?.id), data, hojeISO),
    onSuccess: invalidar,
  });
}

export interface EntrouInput {
  valor: number;
  descricao?: string;
  carteira_id: string;
  data: string;
}

export function useEntrouDinheiro(hojeISO: string) {
  const { user } = useAuth();
  const invalidar = useInvalidarSaldo();
  return useMutation({
    mutationFn: (data: EntrouInput) => carteirasService.entrouDinheiro(requireUserId(user?.id), data, hojeISO),
    onSuccess: invalidar,
  });
}

export interface TransferirInput {
  origem_id: string;
  destino_id: string;
  valor: number;
  data: string;
}

export function useTransferir(hojeISO: string) {
  const { user } = useAuth();
  const invalidar = useInvalidarSaldo();
  return useMutation({
    mutationFn: (data: TransferirInput) => carteirasService.transferir(requireUserId(user?.id), data, hojeISO),
    onSuccess: invalidar,
  });
}

export function useCorrigirSaldo(hojeISO: string) {
  const { user } = useAuth();
  const invalidar = useInvalidarSaldo();
  return useMutation({
    onMutate: (data: { carteira_id: string; saldo_real: number; chave?: string }) => { data.chave = crypto.randomUUID(); },
    mutationFn: (data: { carteira_id: string; saldo_real: number; chave?: string }) =>
      carteirasService.corrigirSaldo(requireUserId(user?.id), data, hojeISO, data.chave),
    onSuccess: invalidar,
  });
}

export function useReceberRenda() {
  const { user } = useAuth();
  const invalidar = useInvalidarSaldo();
  return useMutation({
    mutationFn: ({ rendaId, competencia, carteira_id }: { rendaId: string; competencia: Competencia; carteira_id?: string | null }) =>
      carteirasService.receberRenda(requireUserId(user?.id), rendaId, { competencia, carteira_id }),
    // Também no erro: 409 "já recebida" (outra aba) precisa refletir o estado real.
    onSettled: invalidar,
  });
}

export function useDesfazerRecebimento() {
  const { user } = useAuth();
  const invalidar = useInvalidarSaldo();
  return useMutation({
    mutationFn: ({ rendaId, competencia }: { rendaId: string; competencia: Competencia }) =>
      carteirasService.desfazerRecebimento(requireUserId(user?.id), rendaId, competencia),
    onSettled: invalidar,
  });
}
