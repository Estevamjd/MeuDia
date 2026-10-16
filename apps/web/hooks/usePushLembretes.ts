'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from './useAuth';
import { useVapidPublicKey } from '../components/AppModeProvider';
import { calcularEstadoPush, isIOS, payloadInscricao, urlBase64ToUint8Array, type EstadoPush } from '../lib/push';

function suportaPush(): boolean {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

function isStandalone(): boolean {
  const nav = navigator as Navigator & { standalone?: boolean };
  return window.matchMedia('(display-mode: standalone)').matches || nav.standalone === true;
}

async function enviarInscricao(method: 'POST' | 'DELETE', body: unknown) {
  const res = await fetch('/api/push/subscribe', {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Falha ao ${method === 'POST' ? 'ativar' : 'desativar'} lembretes`);
}

/**
 * Estado e ações da inscrição Web Push. A permissão só é pedida em `ativar()`,
 * que deve ser chamado num toque do usuário (nunca no carregamento).
 */
export function usePushLembretes() {
  const { user } = useAuth();
  const atualizacao = useRef(0);
  const vapidPublicKey = useVapidPublicKey();
  const [estado, setEstado] = useState<EstadoPush>('carregando');
  const [ocupado, setOcupado] = useState(false);

  const atualizar = useCallback(async () => {
    const versao = ++atualizacao.current;
    const suportado = suportaPush();
    let inscrito = false;
    if (suportado) {
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      if (sub && user?.id) {
        const res = await fetch(`/api/push/subscribe?endpoint=${encodeURIComponent(sub.endpoint)}`, { cache: 'no-store' });
        if (res.ok) {
          const registro = await res.json();
          inscrito = registro.inscrito === true && registro.userId === user.id;
        }
      }
    }
    if (versao !== atualizacao.current) return;
    setEstado(
      calcularEstadoPush({
        suportado,
        configurado: !!vapidPublicKey,
        ios: isIOS(navigator.userAgent, navigator.maxTouchPoints),
        standalone: isStandalone(),
        permissao: suportado ? Notification.permission : 'default',
        inscrito,
      }),
    );
  }, [vapidPublicKey, user?.id]);

  useEffect(() => {
    setEstado('carregando');
    let cancelado = false;
    void atualizar().catch(() => { if (!cancelado) setEstado('inativo'); });
    return () => { cancelado = true; atualizacao.current++; };
  }, [atualizar]);

  const ativar = useCallback(async () => {
    if (!vapidPublicKey) return;
    setOcupado(true);
    try {
      const permissao = await Notification.requestPermission();
      if (permissao !== 'granted') return;
      const reg = await navigator.serviceWorker.ready;
      const sub =
        (await reg.pushManager.getSubscription()) ??
        (await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
        }));
      try {
        await enviarInscricao('POST', payloadInscricao(sub.toJSON(), navigator.userAgent));
      } catch (error) {
        // Sem registro no servidor a inscrição local não recebe nada: desfaz para não mostrar "ativo".
        await sub.unsubscribe().catch(() => undefined);
        throw error;
      }
    } finally {
      setOcupado(false);
      await atualizar();
    }
  }, [vapidPublicKey, atualizar]);

  const desativar = useCallback(async () => {
    setOcupado(true);
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      if (!sub) return;
      await enviarInscricao('DELETE', { endpoint: sub.endpoint });
      await sub.unsubscribe();
    } finally {
      setOcupado(false);
      await atualizar();
    }
  }, [atualizar]);

  return { estado, ocupado, ativar, desativar };
}
