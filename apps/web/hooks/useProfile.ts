'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { profileService } from '@meudia/api';
import type { ProfileUpdate } from '@meudia/shared';
import { profileKey } from '../lib/onboarding';
import { useAuth } from './useAuth';

/** `refetchOnMount: 'always'` para quem decide redirecionamentos (não confiar só no cache). */
export function useProfile(opcoes: { refetchOnMount?: boolean | 'always' } = {}) {
  const { user } = useAuth();

  return useQuery({
    queryKey: profileKey(user?.id),
    queryFn: () => profileService.obterPerfil(user!.id),
    enabled: !!user?.id,
    ...opcoes,
  });
}

export function useUpdateProfile() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: ProfileUpdate) => profileService.atualizarPerfil(user!.id, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: profileKey(user?.id) });
    },
  });
}
