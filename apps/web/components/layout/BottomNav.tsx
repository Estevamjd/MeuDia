'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { useState } from 'react';
import { clsx } from 'clsx';
import { Dumbbell, House, LayoutDashboard, Salad, type LucideIcon } from 'lucide-react';
import { useAppMode } from '../AppModeProvider';
import {
  BOTTOM_TABS_PADRAO,
  MENU_MAIS_PADRAO,
  isNavAtivo,
  itensBottomFinancas,
  type IconeAba,
} from '../../lib/navegacao';

const TABS_PRINCIPAIS = BOTTOM_TABS_PADRAO;
const MENU_MAIS = MENU_MAIS_PADRAO;

export function BottomNav() {
  const mode = useAppMode();
  return mode === 'financas' ? <BottomNavFinancas /> : <BottomNavPadrao />;
}

const ICONES: Record<IconeAba, LucideIcon> = {
  house: House,
  dumbbell: Dumbbell,
  salad: Salad,
  'layout-dashboard': LayoutDashboard,
};

const ABA =
  'relative flex min-h-[56px] min-w-[44px] flex-1 flex-col items-center justify-center gap-1 px-1 pb-1 pt-2 text-[11px] font-medium leading-tight transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent';

/**
 * Modo Finanças: Início · Treino · Dieta · Painel (docs/ia-navegacao.md). Sem "Mais": o ☰ no topo já abre o menu.
 * A ativa fica ciano, com `aria-current="page"`.
 */
function BottomNavFinancas() {
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

function BottomNavPadrao() {
  const pathname = usePathname();
  const [maisAberto, setMaisAberto] = useState(false);

  const rotaNoMais = MENU_MAIS.some((item) => pathname === item.href || pathname.startsWith(item.href + '/'));

  return (
    <>
      {/* Overlay do menu Mais */}
      {maisAberto && (
        <div
          className="fixed inset-0 z-modal bg-black/50 backdrop-blur-sm md:hidden"
          onClick={() => setMaisAberto(false)}
        />
      )}

      {/* Menu Mais expandido */}
      {maisAberto && (
        <div
          className="fixed bottom-16 left-0 right-0 z-modal mx-4 mb-2 rounded-2xl border border-text/10 bg-card p-3 shadow-2xl md:hidden"
          style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        >
          <div className="grid grid-cols-3 gap-2">
            {MENU_MAIS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMaisAberto(false)}
                className={`flex flex-col items-center gap-1 rounded-xl p-3 transition-colors ${
                  pathname === item.href || pathname.startsWith(item.href + '/')
                    ? 'bg-accent/20 text-text'
                    : 'text-muted hover:bg-text/5'
                }`}
              >
                <span className="text-xl">{item.emoji}</span>
                <span className="text-[10px] font-medium">{item.label}</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Bottom Navigation Bar */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-nav border-t border-text/10 bg-card/95 backdrop-blur-xl md:hidden"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="flex items-center justify-around px-2 py-1">
          {TABS_PRINCIPAIS.map((tab) => {
            if (tab.href === '/mais') {
              const maisItem = rotaNoMais ? MENU_MAIS.find((m) => pathname === m.href || pathname.startsWith(m.href + '/')) : null;
              return (
                <button
                  key="mais"
                  onClick={() => setMaisAberto(!maisAberto)}
                  className={`flex flex-col items-center gap-0.5 px-3 py-2 transition-colors ${
                    maisAberto || rotaNoMais ? 'text-accent' : 'text-gray-500'
                  }`}
                >
                  <span className="text-xl">{maisItem?.emoji || tab.emoji}</span>
                  <span className="text-[10px] font-medium">
                    {maisItem?.label || tab.label}
                  </span>
                </button>
              );
            }

            const ativo = pathname === tab.href || pathname.startsWith(tab.href + '/');
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`flex flex-col items-center gap-0.5 px-3 py-2 transition-colors ${
                  ativo ? 'text-accent' : 'text-gray-500'
                }`}
              >
                <span className="text-xl">{tab.emoji}</span>
                <span className="text-[10px] font-medium">{tab.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
