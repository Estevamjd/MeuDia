'use client';

import { useCallback, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { clsx } from 'clsx';
import { Menu, MessageCircle } from 'lucide-react';
import { useAppMode } from '../AppModeProvider';
import { tabsTopbar } from '../../lib/topbar';
import { NavDrawer } from './NavDrawer';

const PAGE_TITLES: Record<string, string> = {
  '/inicio': '✦ MeuDia',
  '/treinos': '🏋️ Treinos',
  '/notas': '📝 Notas',
  '/agenda': '📅 Agenda',
  '/habitos': '✅ Hábitos',
  '/financas': '💰 Finanças',
  '/financas/contas': '🧾 Contas',
  '/financas/orcamento': '📊 Orçamento',
  '/financas/gastos': '🧾 Gastos',
  '/financas/metas': '🎯 Metas',
  '/financas/carteiras': '🏦 Bancos',
  '/compras': '🛒 Compras',
  '/veiculo': '🚗 Veículo',
  '/assinaturas': '💳 Assinaturas',
  '/configuracoes': '⚙️ Configurações',
};

const DRAWER_ID = 'menu-lateral';

interface TopbarProps {
  /** Usado pelo "Sair" do menu lateral (modo Finanças). */
  onSignOut?: () => void;
  /** Modo Finanças: ícone do assistente no header (abre o AgentPanel do layout). */
  onOpenChat?: () => void;
  chatAberto?: boolean;
}

export function Topbar({ onSignOut, onOpenChat, chatAberto = false }: TopbarProps) {
  const pathname = usePathname();
  const mode = useAppMode();
  const tabs = tabsTopbar(mode);
  const comDrawer = mode === 'financas' && !!onSignOut;
  const [drawerAberto, setDrawerAberto] = useState(false);
  const botaoMenuRef = useRef<HTMLButtonElement>(null);
  const fecharDrawer = useCallback(() => setDrawerAberto(false), []);

  const pageTitle = PAGE_TITLES[pathname] ?? '✦ MeuDia';

  return (
    <>
      <nav
        className="sticky top-0 z-header border-b border-border"
        style={{
          background: 'rgba(16,16,26,0.95)',
          backdropFilter: 'blur(12px)',
          // Finanças no celular: mesma margem de 1rem do conteúdo (a Início precisa caber sem rolar).
          paddingLeft: comDrawer ? 'max(1rem, env(safe-area-inset-left))' : 'max(2rem, env(safe-area-inset-left))',
          paddingRight: comDrawer ? 'max(1rem, env(safe-area-inset-right))' : 'max(2rem, env(safe-area-inset-right))',
          paddingTop: 'env(safe-area-inset-top)',
        }}
      >
        {/* Mobile (e desktop sem abas no modo): show page title */}
        <div
          className={clsx('flex min-w-0 items-center gap-2', comDrawer ? 'py-1.5' : 'py-3', tabs.length > 0 && 'md:hidden')}
        >
          {comDrawer && (
            <button
              ref={botaoMenuRef}
              type="button"
              onClick={() => setDrawerAberto(true)}
              aria-label="Abrir menu"
              aria-expanded={drawerAberto}
              // O NavDrawer só existe no DOM quando aberto; nunca referenciar id inexistente.
              aria-controls={drawerAberto ? DRAWER_ID : undefined}
              aria-haspopup="dialog"
              className="-ml-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-text transition-colors hover:bg-card2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent md:hidden"
            >
              <Menu size={22} aria-hidden="true" />
            </button>
          )}
          <span className="min-w-0 flex-1 truncate font-syne text-base font-bold text-text">{pageTitle}</span>
          {comDrawer && onOpenChat && (
            <button
              type="button"
              onClick={onOpenChat}
              aria-label="Abrir assistente"
              aria-haspopup="dialog"
              aria-expanded={chatAberto}
              className="-mr-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-accent transition-colors hover:bg-card2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent md:hidden"
            >
              <MessageCircle size={22} aria-hidden="true" />
            </button>
          )}
        </div>

        {/* Desktop: show tabs */}
        <div className={clsx('hidden items-center gap-1', tabs.length > 0 && 'md:flex')}>
          {tabs.map((tab) => {
            const isActive = pathname === tab.href || pathname.startsWith(tab.href + '/');

            const activeColors = {
              accent: 'text-accent border-accent',
              green:  'text-green border-green',
              orange: 'text-orange border-orange',
            };

            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={clsx(
                  'px-[18px] py-4 text-[13px] font-medium border-b-2 transition-colors whitespace-nowrap',
                  isActive
                    ? activeColors[tab.color]
                    : 'border-transparent text-muted hover:text-text',
                )}
              >
                {tab.label}
              </Link>
            );
          })}
        </div>
      </nav>

      {comDrawer && onSignOut && (
        <NavDrawer
          id={DRAWER_ID}
          isOpen={drawerAberto}
          onClose={fecharDrawer}
          onSignOut={onSignOut}
          returnFocusRef={botaoMenuRef}
        />
      )}
    </>
  );
}
