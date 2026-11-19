'use client';

import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { createClient } from '../../lib/supabase/client';
import { useToast } from '../ui/Toast';
import { esquecerToken, MENSAGEM_VINCULO, tokenGuardado, vincularWhatsapp } from '../../lib/whatsapp/vinculo';

/** Liga o WhatsApp depois de criar a conta/entrar, quando a pessoa chegou pelo link do bot (/whatsapp?t=…). */
export function VinculoPendente() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const feito = useRef(false);

  useEffect(() => {
    if (feito.current) return;
    feito.current = true;
    const token = tokenGuardado();
    if (!token) return;
    void vincularWhatsapp(createClient(), token).then((r) => {
      if (r.ok) {
        esquecerToken();
        void queryClient.invalidateQueries({ queryKey: ['profile'] });
        toast.success('WhatsApp ligado! Pode mandar seus gastos e treinos por lá.');
      } else {
        if (r.motivo !== 'falhou') esquecerToken();
        toast.error(MENSAGEM_VINCULO[r.motivo]);
      }
    });
  }, [queryClient, toast]);

  return null;
}
