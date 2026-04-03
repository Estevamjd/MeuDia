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

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, signOut } = useAuth();
  const { data: profile, isLoading: loadingProfile } = useProfile();
  const router = useRouter();
  const { isOnline, isSyncing, pendingCount, lastSyncError, forceSync } =
    useOfflineSync(handleOfflineAction);
  const [agentOpen, setAgentOpen] = useState(false);

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

        <div className="relative z-10 flex flex-1 flex-col">
          <Topbar />
          <main
            className="flex-1 overflow-y-auto p-8 pb-24 md:pb-8"
            style={{
              paddingLeft: 'max(2rem, env(safe-area-inset-left))',
              paddingRight: 'max(2rem, env(safe-area-inset-right))',
            }}
          >
            {children}
          </main>
        </div>
      </div>

      {/* Agente IA */}
      <AgentFAB onClick={() => setAgentOpen(true)} />
      <AgentPanel isOpen={agentOpen} onClose={() => setAgentOpen(false)} />

      <BottomNav />
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
