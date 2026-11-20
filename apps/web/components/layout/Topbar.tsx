'use client';

import { useRef } from 'react';
import { usePathname } from 'next/navigation';
import { clsx } from 'clsx';
import { Menu, MessageCircle } from 'lucide-react';
import { NavDrawer } from './NavDrawer';
import { useMenuLateral } from '../../lib/menu-lateral';

const PAGE_TITLES: Record<string, string> = {
  '/saude': '🩺 Saúde',
  '/saude/dieta': '🩺 Saúde',
  '/saude/peso': '🩺 Saúde',
  '/treinos': '🏋️ Treino',
  '/treinos/plano': '🗓️ Plano de treino',
  '/refeicoes': '🥗 Dieta',
  '/financas': '💰 Finanças',
  '/financas/contas': '🧾 Contas',
  '/financas/orcamento': '📊 Orçamento',
  '/financas/gastos': '🧾 Gastos',
  '/financas/metas': '🎯 Metas',
  '/financas/carteiras': '🏦 Bancos',
  '/financas/relatorio': 'Painel',
  '/assinaturas': '💳 Assinaturas',
  '/configuracoes': '⚙️ Configurações',
};

const DRAWER_ID = 'menu-lateral';

interface TopbarProps {
  /** Usado pelo "Sair" do menu lateral; sem ele o topo mostra só o título da página. */
  onSignOut?: () => void;
  /** Ícone do assistente no header no celular (abre o AgentPanel do layout). */
  onOpenChat?: () => void;
  chatAberto?: boolean;
}

export function Topbar({ onSignOut, onOpenChat, chatAberto = false }: TopbarProps) {
  const pathname = usePathname();
  // Os dois modos usam a mesma navegação (☰ + barra de baixo) desde a faxina dos módulos legados.
  const comDrawer = !!onSignOut;
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
          background: 'var(--topo-fundo)',
          backdropFilter: 'blur(12px)',
          // Finanças no celular: mesma margem de 1rem do conteúdo (a Início precisa caber sem rolar).
          paddingLeft: comDrawer ? 'max(1rem, env(safe-area-inset-left))' : 'max(2rem, env(safe-area-inset-left))',
          paddingRight: comDrawer ? 'max(1rem, env(safe-area-inset-right))' : 'max(2rem, env(safe-area-inset-right))',
          paddingTop: 'env(safe-area-inset-top)',
        }}
      >
        <div className={clsx('flex min-w-0 items-center gap-2', comDrawer ? 'py-1.5' : 'py-3')}>
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
            // Cada tela tem o próprio título grande; o topo só leva a marca (design v2).
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
