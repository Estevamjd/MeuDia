'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { clsx } from 'clsx';
import { Dumbbell, House, LayoutDashboard, Salad, type LucideIcon } from 'lucide-react';
import { isNavAtivo, itensBottomFinancas, type IconeAba } from '../../lib/navegacao';

const ICONES: Record<IconeAba, LucideIcon> = {
  house: House,
  dumbbell: Dumbbell,
  salad: Salad,
  'layout-dashboard': LayoutDashboard,
};

const ABA =
  'relative flex min-h-[56px] min-w-[44px] flex-1 flex-col items-center justify-center gap-1 px-1 pb-1 pt-2 text-[11px] font-medium leading-tight transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent';

/**
 * Início · Treino · Dieta · Painel (docs/ia-navegacao.md), nos dois modos. Sem "Mais": o ☰ no topo já abre o menu.
 * A ativa fica ciano, com `aria-current="page"`.
 */
export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Navegação principal"
      className="fixed bottom-0 left-0 right-0 z-nav border-t border-border bg-[var(--barra-fundo)] backdrop-blur-xl md:hidden"
      style={{
        paddingBottom: 'env(safe-area-inset-bottom)',
        paddingLeft: 'env(safe-area-inset-left)',
        paddingRight: 'env(safe-area-inset-right)',
      }}
    >
      <div className="grid grid-cols-4 items-stretch px-2">
        {itensBottomFinancas().map((item) => {
          const ativo = isNavAtivo(pathname, item);
          const Icone = ICONES[item.icone];
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={ativo ? 'page' : undefined}
              className={clsx(ABA, ativo ? 'text-accent' : 'text-muted hover:text-text')}
            >
              <Icone size={20} aria-hidden="true" className={ativo ? 'drop-shadow-[0_0_8px_rgb(var(--c-brilho)/0.55)]' : undefined} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
