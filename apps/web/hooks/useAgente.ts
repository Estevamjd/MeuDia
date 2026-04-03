'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { agenteService } from '@meudia/api';
import type {
  NotificacaoAgenteInsert,
  MensagemChatInsert,
  PreferenciasAgenteUpdate,
} from '@meudia/shared';
import { useAuth } from './useAuth';

// ══════════════════════════════════════════════════════════════════════════════
// Notificações
// ══════════════════════════════════════════════════════════════════════════════

export function useNotificacoes() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['notificacoes-agente', user?.id],
    queryFn: () => agenteService.listarNotificacoes(user!.id),
    enabled: !!user?.id,
    staleTime: 1000 * 60 * 2, // 2 min
  });
}

export function useNotificacoesNaoLidas() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['notificacoes-agente-nao-lidas', user?.id],
    queryFn: () => agenteService.notificacoesNaoLidas(user!.id),
    enabled: !!user?.id,
    staleTime: 1000 * 60, // 1 min
  });
}

export function useContarNaoLidas() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['notificacoes-agente-count', user?.id],
    queryFn: () => agenteService.contarNaoLidas(user!.id),
    enabled: !!user?.id,
    staleTime: 1000 * 30, // 30s
    refetchInterval: 1000 * 60, // Poll every 60s
  });
}

export function useCriarNotificacao() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: NotificacaoAgenteInsert) => {
      if (!user?.id) throw new Error('Usuário não autenticado');
      return agenteService.criarNotificacao(user.id, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notificacoes-agente'] });
      queryClient.invalidateQueries({ queryKey: ['notificacoes-agente-nao-lidas'] });
      queryClient.invalidateQueries({ queryKey: ['notificacoes-agente-count'] });
    },
  });
}

export function useMarcarNotificacaoLida() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (notificacaoId: string) =>
      agenteService.marcarNotificacaoLida(notificacaoId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notificacoes-agente'] });
      queryClient.invalidateQueries({ queryKey: ['notificacoes-agente-nao-lidas'] });
      queryClient.invalidateQueries({ queryKey: ['notificacoes-agente-count'] });
    },
  });
}

export function useMarcarTodasLidas() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => {
      if (!user?.id) throw new Error('Usuário não autenticado');
      return agenteService.marcarTodasNotificacoesLidas(user.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notificacoes-agente'] });
      queryClient.invalidateQueries({ queryKey: ['notificacoes-agente-nao-lidas'] });
      queryClient.invalidateQueries({ queryKey: ['notificacoes-agente-count'] });
    },
  });
}

export function useDispensarNotificacao() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (notificacaoId: string) =>
      agenteService.dispensarNotificacao(notificacaoId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notificacoes-agente'] });
      queryClient.invalidateQueries({ queryKey: ['notificacoes-agente-nao-lidas'] });
      queryClient.invalidateQueries({ queryKey: ['notificacoes-agente-count'] });
    },
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// Chat
// ══════════════════════════════════════════════════════════════════════════════

export function useMensagensChat() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['chat-agente', user?.id],
    queryFn: () => agenteService.mensagensRecentes(user!.id, 30),
    enabled: !!user?.id,
    staleTime: 1000 * 60,
  });
}

export function useEnviarMensagem() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: MensagemChatInsert) => {
      if (!user?.id) throw new Error('Usuário não autenticado');
      return agenteService.enviarMensagem(user.id, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chat-agente'] });
    },
  });
}

export function useLimparChat() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => {
      if (!user?.id) throw new Error('Usuário não autenticado');
      return agenteService.limparChat(user.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chat-agente'] });
    },
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// Preferências
// ══════════════════════════════════════════════════════════════════════════════

export function usePreferenciasAgente() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['preferencias-agente', user?.id],
    queryFn: () => agenteService.obterPreferencias(user!.id),
    enabled: !!user?.id,
    staleTime: 1000 * 60 * 5,
  });
}

export function useAtualizarPreferencias() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: PreferenciasAgenteUpdate) => {
      if (!user?.id) throw new Error('Usuário não autenticado');
      return agenteService.atualizarPreferencias(user.id, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['preferencias-agente'] });
    },
  });
}
