'use client';

import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'meudia_treino_em_andamento';

export interface TreinoEmAndamento {
  sessaoId: string;
  treinoId: string;
  treinoNome: string;
  iniciadoEm: number;
  seriesCompletas: Record<string, boolean>;
}

export function useTreinoEmAndamento() {
  const [treino, setTreino] = useState<TreinoEmAndamento | null>(null);
  const [loaded, setLoaded] = useState(false);

  // Carregar do localStorage na montagem
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        setTreino(JSON.parse(saved) as TreinoEmAndamento);
      }
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    }
    setLoaded(true);
  }, []);

  const iniciar = useCallback((data: TreinoEmAndamento) => {
    setTreino(data);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }, []);

  const marcarSerie = useCallback((serieKey: string) => {
    setTreino((prev) => {
      if (!prev) return null;
      const updated = {
        ...prev,
        seriesCompletas: { ...prev.seriesCompletas, [serieKey]: true },
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  const desmarcarSerie = useCallback((serieKey: string) => {
    setTreino((prev) => {
      if (!prev) return null;
      const { [serieKey]: _, ...rest } = prev.seriesCompletas;
      const updated = { ...prev, seriesCompletas: rest };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  const finalizar = useCallback(() => {
    setTreino(null);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  return {
    treino,
    loaded,
    temTreinoEmAndamento: !!treino,
    iniciar,
    marcarSerie,
    desmarcarSerie,
    finalizar,
  };
}
