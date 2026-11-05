'use client';

import { useCallback, useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { dietaService } from '@meudia/api';
import { somarDias } from '@meudia/shared';
import { useAuth } from './useAuth';
import { EVENTO_PERFIL_SAUDE, lerPerfilSaude, salvarPerfilSaude, type PerfilSaude } from '../lib/perfil-saude';

export const hojeLocal = () => format(new Date(), 'yyyy-MM-dd');

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
  return useMutation({
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

/**
 * Perfil de saúde guardado neste aparelho (sem a 009). `carregado` = já leu o localStorage
 * (evita abrir o cadastro por um instante antes de saber se a pessoa já respondeu).
 */
export function usePerfilSaude() {
  const { user } = useAuth();
  const userId = user?.id;
  const [perfil, setPerfil] = useState<PerfilSaude | null>(null);
  const [carregado, setCarregado] = useState(false);

  useEffect(() => {
    if (!userId) return;
    const ler = () => {
      setPerfil(lerPerfilSaude(userId));
      setCarregado(true);
    };
    ler();
    window.addEventListener(EVENTO_PERFIL_SAUDE, ler);
    window.addEventListener('storage', ler);
    return () => {
      window.removeEventListener(EVENTO_PERFIL_SAUDE, ler);
      window.removeEventListener('storage', ler);
    };
  }, [userId]);

  const salvar = useCallback(
    (novo: PerfilSaude) => {
      if (!userId) return false;
      const ok = salvarPerfilSaude(userId, novo);
      setPerfil(novo);
      return ok;
    },
    [userId],
  );

  return { perfil, carregado: carregado && !!userId, salvar };
}
