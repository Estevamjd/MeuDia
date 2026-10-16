'use client';

import { createContext, useContext, type ReactNode } from 'react';
import type { AppMode } from '../lib/app-mode';

interface AppConfig {
  mode: AppMode;
  /** Chave pública VAPID (lida no servidor); `null` = push não configurado. */
  vapidPublicKey: string | null;
}

const AppModeContext = createContext<AppConfig>({ mode: 'padrao', vapidPublicKey: null });

export function AppModeProvider({ children, ...config }: AppConfig & { children: ReactNode }) {
  return <AppModeContext.Provider value={config}>{children}</AppModeContext.Provider>;
}

export function useAppMode(): AppMode {
  return useContext(AppModeContext).mode;
}

export function useVapidPublicKey(): string | null {
  return useContext(AppModeContext).vapidPublicKey;
}
