'use client';

import { useState, useEffect, useRef, type RefObject } from 'react';
import { Download, Share, X, Plus } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

type Platform = 'ios' | 'android' | 'desktop' | null;

function detectPlatform(): Platform {
  if (typeof window === 'undefined') return null;
  const ua = navigator.userAgent || '';
  if (/iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) {
    return 'ios';
  }
  if (/android/i.test(ua)) return 'android';
  return 'desktop';
}

// z-banner (lib/camadas.ts): abaixo da BottomNav, dos modais e do assistente, que não podem ficar cobertos.
// No mobile sobe acima da BottomNav (fixa no rodapé).
const CONTAINER =
  'fixed bottom-[calc(5rem+env(safe-area-inset-bottom))] left-4 right-4 z-banner md:bottom-4 md:left-auto md:right-6';

/** Variável CSS com o espaço que o banner ocupa a partir do rodapé (+8px); o `main` do layout reserva esse espaço. */
export const VAR_RESERVA_BANNER = '--reserva-banner';

/**
 * Enquanto o banner está na tela, publica em `--reserva-banner` a distância do topo dele até o fim do viewport.
 * Assim nenhum conteúdo acionável fica preso atrás do banner: rolando até o fim, tudo para acima dele.
 */
function useReservaBanner(ref: RefObject<HTMLElement>, visivel: boolean) {
  useEffect(() => {
    const el = ref.current;
    const raiz = document.documentElement;
    if (!visivel || !el) return;
    const medir = () => raiz.style.setProperty(VAR_RESERVA_BANNER, `${Math.ceil(window.innerHeight - el.getBoundingClientRect().top + 8)}px`);
    medir();
    const obs = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(medir);
    obs?.observe(el);
    window.addEventListener('resize', medir);
    return () => {
      obs?.disconnect();
      window.removeEventListener('resize', medir);
      raiz.style.removeProperty(VAR_RESERVA_BANNER);
    };
  }, [ref, visivel]);
}

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIOSPrompt, setShowIOSPrompt] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [platform, setPlatform] = useState<Platform>(null);
  const ref = useRef<HTMLDivElement>(null);
  const iosVisivel = platform === 'ios' && showIOSPrompt && !dismissed;
  useReservaBanner(ref, iosVisivel || (!!deferredPrompt && !dismissed));

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (isStandalone()) return;
    if (localStorage.getItem('pwa-dismissed')) return;

    const plat = detectPlatform();
    setPlatform(plat);

    if (plat === 'ios') {
      // iOS não suporta beforeinstallprompt, mostra instruções manuais
      const timer = setTimeout(() => setShowIOSPrompt(true), 2000);
      return () => clearTimeout(timer);
    }

    // Android/Desktop
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
    }
  };

  const handleDismiss = () => {
    setDismissed(true);
    setShowIOSPrompt(false);
    localStorage.setItem('pwa-dismissed', 'true');
  };

  // iOS prompt
  if (iosVisivel) {
    return (
      <div ref={ref} className={`${CONTAINER} md:w-96`}>
        <div className="rounded-card border border-accent/30 bg-card p-4 shadow-lg shadow-accent/10">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-semibold text-text">Instalar MeuDia</p>
            <button
              onClick={handleDismiss}
              className="rounded-lg p-1.5 text-muted transition-colors hover:text-text"
              aria-label="Fechar"
            >
              <X size={14} />
            </button>
          </div>
          <div className="space-y-2.5">
            <div className="flex items-center gap-3 text-xs text-muted">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-accent/[0.14]">
                <Share size={14} className="text-accent" />
              </div>
              <span>
                Toque em <strong className="text-text">Compartilhar</strong> na barra do Safari
              </span>
            </div>
            <div className="flex items-center gap-3 text-xs text-muted">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-accent/[0.14]">
                <Plus size={14} className="text-accent" />
              </div>
              <span>
                Selecione <strong className="text-text">Adicionar à Tela de Início</strong>
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Android/Desktop prompt
  if (!deferredPrompt || dismissed) return null;

  return (
    <div ref={ref} className={`${CONTAINER} md:w-80`}>
      <div className="flex items-center gap-3 rounded-card border border-accent/30 bg-card p-4 shadow-lg shadow-accent/10">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent/[0.14]">
          <Download size={20} className="text-accent" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold text-text">Instalar MeuDia</p>
          <p className="text-xs text-muted">Acesse mais rapido direto da tela inicial</p>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={handleInstall}
            className="rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-accent/80"
          >
            Instalar
          </button>
          <button
            onClick={handleDismiss}
            className="rounded-lg p-1.5 text-muted transition-colors hover:text-text"
            aria-label="Dispensar"
          >
            <X size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
