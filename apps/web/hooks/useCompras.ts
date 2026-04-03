'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { comprasService } from '@meudia/api';
import type { ListaComprasInsert, ItemCompraInsert } from '@meudia/shared';
import { useAuth } from './useAuth';
import { withOfflineSupport } from '../lib/offline-mutation';

export function useListas() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['listas-compras', user?.id],
    queryFn: () => comprasService.listarListas(user!.id),
    enabled: !!user?.id,
  });
}

export function useItensLista(listaId: string | null) {
  return useQuery({
    queryKey: ['itens-compras', listaId],
    queryFn: () => comprasService.obterItens(listaId!),
    enabled: !!listaId,
  });
}

export function useCriarLista() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: withOfflineSupport(
      'compras:criar-lista',
      (data: ListaComprasInsert) => {
        if (!user?.id) throw new Error('Não autenticado');
        return comprasService.criarLista(user.id, data);
      },
      (data) => {
        if (!user?.id) throw new Error('Não autenticado');
        return { userId: user.id, data };
      },
    ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['listas-compras'] });
    },
  });
}

export function useExcluirLista() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: withOfflineSupport(
      'compras:excluir-lista',
      (id: string) => comprasService.excluirLista(id),
      (id) => ({ id }),
    ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['listas-compras'] });
    },
  });
}

export function useCriarItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: withOfflineSupport<ItemCompraInsert, unknown>(
      'compras:criar-item',
      (data) => comprasService.adicionarItem(data),
      (data) => ({ data }),
    ),
    onSuccess: (_data, variables: ItemCompraInsert) => {
      void queryClient.invalidateQueries({ queryKey: ['itens-compras', variables.lista_id] });
      void queryClient.invalidateQueries({ queryKey: ['listas-compras'] });
    },
  });
}

export function useAtualizarItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<ItemCompraInsert> }) =>
      comprasService.atualizarItem(id, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['itens-compras'] });
      void queryClient.invalidateQueries({ queryKey: ['listas-compras'] });
    },
  });
}

export function useExcluirItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: withOfflineSupport<{ id: string; listaId: string }, unknown>(
      'compras:excluir-item',
      ({ id }) => comprasService.excluirItem(id),
      ({ id }) => ({ id }),
    ),
    onSuccess: (_data, variables: { id: string; listaId: string }) => {
      void queryClient.invalidateQueries({ queryKey: ['itens-compras', variables.listaId] });
      void queryClient.invalidateQueries({ queryKey: ['listas-compras'] });
    },
  });
}

export function useToggleItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: withOfflineSupport(
      'compras:toggle-item',
      ({ id, comprado }: { id: string; comprado: boolean }) =>
        comprasService.toggleItem(id, comprado),
      ({ id, comprado }) => ({ id, comprado }),
    ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['itens-compras'] });
      void queryClient.invalidateQueries({ queryKey: ['listas-compras'] });
    },
  });
}
