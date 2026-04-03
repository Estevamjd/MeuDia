'use client';

import { useQuery } from '@tanstack/react-query';
import { scoreService } from '@meudia/api';
import { useAuth } from './useAuth';

export function useScoreHoje() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['score', 'hoje', user?.id],
    queryFn: () => scoreService.obterScoreHoje(user!.id),
    enabled: !!user?.id,
  });
}

export function useStreak() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['score', 'streak', user?.id],
    queryFn: () => scoreService.calcularStreak(user!.id),
    enabled: !!user?.id,
  });
}

export function useHistoricoScore(days = 30) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['score', 'historico', user?.id, days],
    queryFn: () => scoreService.obterHistorico(user!.id, days),
    enabled: !!user?.id,
  });
}

export function useConquistas() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['conquistas', user?.id],
    queryFn: () => scoreService.obterConquistas(user!.id),
    enabled: !!user?.id,
  });
}
