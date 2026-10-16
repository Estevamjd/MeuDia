'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Sidebar } from '../../components/layout/Sidebar';
import { Topbar } from '../../components/layout/Topbar';
import { ToastProvider } from '../../components/ui/Toast';
import { useAuth } from '../../hooks/useAuth';
import { useProfile } from '../../hooks/useProfile';
import { Skeleton } from '../../components/ui/Skeleton';
import { InstallPrompt } from '../../components/ui/InstallPrompt';
import { OfflineIndicator } from '../../components/ui/OfflineIndicator';
import { useOfflineSync } from '../../hooks/useOfflineSync';
import { handleOfflineAction } from '../../lib/offline-handlers';
import { AgentFAB } from '../../components/agent/AgentFAB';
import { AgentPanel } from '../../components/agent/AgentPanel';
import { BottomNav } from '../../components/layout/BottomNav';
import { useAppMode } from '../../components/AppModeProvider';
import { clsx } from 'clsx';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, signOut } = useAuth();
  const { data: profile, isLoading: loadingProfile } = useProfile();
  const router = useRouter();
  const { isOnline, isSyncing, pendingCount, lastSyncError, forceSync } =
    useOfflineSync(handleOfflineAction);
  const [agentOpen, setAgentOpen] = useState(false);
  const financas = useAppMode() === 'financas';

  // Redirect to onboarding if user hasn't completed it
  useEffect(() => {
    if (!loading && !loadingProfile && user && profile && !profile.onboarding_feito) {
      router.push('/onboarding');
    }
  }, [loading, loadingProfile, user, profile, router]);

  if (loading || loadingProfile) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg">
        <div className="flex flex-col items-center gap-3">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-4 w-48" />
        </div>
      </div>
    );
  }

  if (!user) {
    router.push('/login');
    return null;
  }

  // Don't render dashboard if onboarding not done
  if (profile && !profile.onboarding_feito) {
    return null;
  }

  const userName = user?.user_metadata?.nome as string | undefined
    ?? user?.email?.split('@')[0]
    ?? 'Usuário';

  return (
    <ToastProvider>
      <div className="flex min-h-screen bg-bg bg-glow-orbs">
        {/* Sidebar desktop */}
        <div className="hidden md:block">
          <Sidebar onSignOut={signOut} userName={userName} onOpenAgent={() => setAgentOpen(true)} />
        </div>

        <div className={clsx('relative z-10 flex flex-1 flex-col', financas && 'min-w-0')}>
          <Topbar onSignOut={signOut} />
          <main
            className={clsx(
              'flex-1 overflow-y-auto p-8 md:pb-8',
              // Modo Finanças: espaço da BottomNav + safe-area; sem overflow horizontal em 375px.
              financas ? 'min-w-0 overflow-x-hidden pb-[calc(6rem+env(safe-area-inset-bottom))]' : 'pb-24',
            )}
            style={{
              paddingLeft: 'max(2rem, env(safe-area-inset-left))',
              paddingRight: 'max(2rem, env(safe-area-inset-right))',
            }}
          >
            {children}
          </main>
        </div>
      </div>

      {/* Modo Finanças: BottomNav antes do painel, para o painel do agente cobri-la no mobile. */}
      {financas && <BottomNav onOpenChat={() => setAgentOpen(true)} chatAberto={agentOpen} />}

      {/* Agente IA (no modo Finanças o "Chat" da BottomNav substitui o FAB no mobile) */}
      <AgentFAB onClick={() => setAgentOpen(true)} className={financas ? 'hidden md:flex' : undefined} />
      <AgentPanel isOpen={agentOpen} onClose={() => setAgentOpen(false)} />

      {!financas && <BottomNav />}
      <InstallPrompt />
      <OfflineIndicator
        isOnline={isOnline}
        isSyncing={isSyncing}
        pendingCount={pendingCount}
        lastSyncError={lastSyncError}
        onForceSync={forceSync}
      />
    </ToastProvider>
  );
}
