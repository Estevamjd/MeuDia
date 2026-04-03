'use client';

import { useMemo } from 'react';
import { useScoreHoje, useStreak, useHistoricoScore, useConquistas } from './useScore';

export interface GamificacaoData {
  scoreHoje: number;
  streak: number;
  scoreMedio7d: number;
  historico: { data: string; score: number }[];
  conquistas: { tipo: string; titulo: string; icone: string; conquistado_em: string }[];
  isLoading: boolean;
}

export function useGamificacao(): GamificacaoData {
  const { data: scoreHoje, isLoading: l1 } = useScoreHoje();
  const { data: streak, isLoading: l2 } = useStreak();
  const { data: historico, isLoading: l3 } = useHistoricoScore(30);
  const { data: conquistas, isLoading: l4 } = useConquistas();

  const scoreMedio7d = useMemo(() => {
    if (!historico || historico.length === 0) return 0;
    const ultimos7 = historico.slice(-7);
    const soma = ultimos7.reduce((acc: number, h: { score: number }) => acc + h.score, 0);
    return Math.round(soma / ultimos7.length);
  }, [historico]);

  return {
    scoreHoje: scoreHoje?.score ?? 0,
    streak: streak ?? 0,
    scoreMedio7d,
    historico: historico ?? [],
    conquistas: conquistas ?? [],
    isLoading: l1 || l2 || l3 || l4,
  };
}
