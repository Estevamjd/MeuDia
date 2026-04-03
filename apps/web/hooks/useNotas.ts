'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '../lib/supabase/client';
import { notasService, notaRepository } from '@meudia/api';
import { useAuth } from './useAuth';

type NotaUpdate = notaRepository.NotaUpdate;

export function useNotas() {
  const supabase = createClient();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const service = supabase ? notasService.createNotasService(supabase) : null;

  const notasQuery = useQuery({
    queryKey: ['notas', user?.id],
    queryFn: () => {
      if (!service || !user?.id) throw new Error('Não autenticado');
      return service.listar(user.id);
    },
    enabled: !!user?.id && !!service,
  });

  const criarNota = useMutation({
    mutationFn: (nota: {
      titulo: string;
      conteudo: string;
      tags?: string[];
      cor?: string;
      fixada?: boolean;
      checklist?: { id: string; text: string; checked: boolean }[];
      lembrete?: string | null;
    }) => {
      if (!service || !user?.id) throw new Error('Não autenticado');
      return service.criar({
        user_id: user.id,
        titulo: nota.titulo,
        conteudo: nota.conteudo,
        tags: nota.tags ?? [],
        cor: nota.cor ?? 'default',
        fixada: nota.fixada ?? false,
        checklist: nota.checklist ?? [],
        lembrete: nota.lembrete ?? null,
      });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notas'] }),
  });

  const atualizarNota = useMutation({
    mutationFn: ({ id, ...updates }: { id: string } & NotaUpdate) => {
      if (!service || !user?.id) throw new Error('Não autenticado');
      return service.atualizar(id, updates, user.id);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notas'] }),
  });

  const excluirNota = useMutation({
    mutationFn: (id: string) => {
      if (!service || !user?.id) throw new Error('Não autenticado');
      return service.excluir(id, user.id);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notas'] }),
  });

  return {
    notas: notasQuery.data ?? [],
    isLoading: notasQuery.isLoading,
    error: notasQuery.error,
    criarNota,
    atualizarNota,
    excluirNota,
  };
}
