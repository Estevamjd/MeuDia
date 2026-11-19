'use client';

import { useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { clsx } from 'clsx';
import { Menu, MessageCircle } from 'lucide-react';
import { useAppMode } from '../AppModeProvider';
import { tabsTopbar } from '../../lib/topbar';
import { NavDrawer } from './NavDrawer';
import { useMenuLateral } from '../../lib/menu-lateral';

const PAGE_TITLES: Record<string, string> = {
  '/inicio': '✦ MeuDia',
  '/saude': '🩺 Saúde',
  '/saude/dieta': '🩺 Saúde',
  '/saude/peso': '🩺 Saúde',
  '/treinos': '🏋️ Treino',
  '/treinos/plano': '🗓️ Plano de treino',
  '/refeicoes': '🥗 Dieta',
  '/notas': '📝 Notas',
  '/agenda': '📅 Agenda',
  '/habitos': '✅ Hábitos',
  '/financas': '💰 Finanças',
  '/financas/contas': '🧾 Contas',
  '/financas/orcamento': '📊 Orçamento',
  '/financas/gastos': '🧾 Gastos',
  '/financas/metas': '🎯 Metas',
  '/financas/carteiras': '🏦 Bancos',
  '/financas/relatorio': 'Relatório',
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
  // Compartilhado com a aba "Mais" da BottomNav.
  const drawerAberto = useMenuLateral((m) => m.aberto);
  const abrirDrawer = useMenuLateral((m) => m.abrir);
  const fecharDrawer = useMenuLateral((m) => m.fechar);
  const botaoMenuRef = useRef<HTMLButtonElement>(null);

  const pageTitle = PAGE_TITLES[pathname] ?? '✦ MeuDia';

  return (
    <>
      <nav
        className={clsx('sticky top-0 z-header', comDrawer ? 'border-b border-transparent md:border-border' : 'border-b border-border')}
        style={{
          background: 'rgba(5,10,22,0.82)',
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
              onClick={abrirDrawer}
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
          {comDrawer ? (
            // Modo Finanças: cada tela tem o próprio título grande; o topo só leva a marca (design v2).
            <span className="lap-rotulo min-w-0 flex-1 truncate text-center text-muted">MeuDia</span>
          ) : (
            <span className="min-w-0 flex-1 truncate font-syne text-base font-bold text-text">{pageTitle}</span>
          )}
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
