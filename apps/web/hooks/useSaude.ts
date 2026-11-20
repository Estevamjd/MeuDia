'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useMutacao } from './useMutacao';
import { dietaService } from '@meudia/api';
import { somarDias } from '@meudia/shared';
import { useAuth } from './useAuth';
import { hojeSP } from '../lib/hoje';

/** Hoje em São Paulo (nome antigo mantido para as telas de Saúde). */
export const hojeLocal = () => hojeSP();

/** Peso dos últimos 90 dias + 6 de folga (a média de 7 dias do primeiro ponto do gráfico olha para trás). */
export function usePesoRecente() {
  const { user } = useAuth();
  const hoje = hojeLocal();
  const desde = somarDias(hoje, -96);
  return useQuery({
    queryKey: ['peso-recente', user?.id, desde],
    queryFn: () => dietaService.pesoDesde(user!.id, desde),
    enabled: !!user?.id,
  });
}

export function useRegistrarPesoDoDia() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  return useMutacao({
    mutationFn: (dados: { peso: number; data?: string }) => {
      if (!user?.id) throw new Error('Nao autenticado');
      return dietaService.registrarPesoDoDia(user.id, { peso: dados.peso, data: dados.data ?? hojeLocal() });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['peso-recente'] });
      void queryClient.invalidateQueries({ queryKey: ['historico-peso'] });
    },
  });
}

/** Perfil de saúde: `hooks/usePerfilSaude.ts` (conta + cache do aparelho). */
export { usePerfilSaude } from './usePerfilSaude';
