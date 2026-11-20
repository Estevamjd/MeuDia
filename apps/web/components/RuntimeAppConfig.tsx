import type { ReactNode } from 'react';
import { unstable_noStore as noStore } from 'next/cache';
import { AppModeProvider } from './AppModeProvider';
import { getAppMode } from '../lib/app-mode';

/**
 * Lê `APP_MODE` e `VAPID_PUBLIC_KEY` por request (server component) e entrega ao cliente pelo AppModeProvider.
 * O `noStore()` fica aqui, e não no layout raiz, para só as árvores que leem o modo (dashboard e onboarding) serem
 * dinâmicas; as páginas públicas (login, termos…) podem ser estáticas. Sem ele o modo congela no valor do build.
 */
export function RuntimeAppConfig({ children }: { children: ReactNode }) {
  noStore();
  return (
    <AppModeProvider mode={getAppMode()} vapidPublicKey={process.env.VAPID_PUBLIC_KEY || null}>
      {children}
    </AppModeProvider>
  );
}
