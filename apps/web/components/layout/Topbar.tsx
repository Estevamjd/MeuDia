'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { clsx } from 'clsx';
import { useAppMode } from '../AppModeProvider';
import { tabsTopbar } from '../../lib/topbar';

const PAGE_TITLES: Record<string, string> = {
  '/inicio': '✦ MeuDia',
  '/treinos': '🏋️ Treinos',
  '/notas': '📝 Notas',
  '/agenda': '📅 Agenda',
  '/habitos': '✅ Hábitos',
  '/financas': '💰 Finanças',
  '/financas/contas': '🧾 Contas',
  '/financas/orcamento': '📊 Orçamento',
  '/compras': '🛒 Compras',
  '/veiculo': '🚗 Veículo',
  '/assinaturas': '💳 Assinaturas',
  '/configuracoes': '⚙️ Configurações',
};

export function Topbar() {
  const pathname = usePathname();
  const tabs = tabsTopbar(useAppMode());

  const pageTitle = PAGE_TITLES[pathname] ?? '✦ MeuDia';

  return (
    <nav
      className="sticky top-0 z-20 border-b border-border"
      style={{
        background: 'rgba(16,16,26,0.95)',
        backdropFilter: 'blur(12px)',
        paddingLeft: 'max(2rem, env(safe-area-inset-left))',
        paddingRight: 'max(2rem, env(safe-area-inset-right))',
        paddingTop: 'env(safe-area-inset-top)',
      }}
    >
      {/* Mobile (e desktop sem abas no modo): show page title */}
      <div className={clsx('flex items-center py-3', tabs.length > 0 && 'md:hidden')}>
        <span className="font-syne text-base font-bold text-text">{pageTitle}</span>
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
  );
}
