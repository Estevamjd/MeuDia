'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { useState } from 'react';
import { clsx } from 'clsx';
import { House, Landmark, ReceiptText, Settings, Target, type LucideIcon } from 'lucide-react';
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
  'receipt-text': ReceiptText,
  target: Target,
  landmark: Landmark,
  settings: Settings,
};

/** 5 abas fixas com rótulo sempre visível; a ativa tem cor accent, traço no topo e `aria-current="page"`. */
function BottomNavFinancas() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Navegação principal"
      className="fixed bottom-0 left-0 right-0 z-nav border-t border-white/10 bg-card/95 backdrop-blur-xl md:hidden"
      style={{
        paddingBottom: 'env(safe-area-inset-bottom)',
        paddingLeft: 'env(safe-area-inset-left)',
        paddingRight: 'env(safe-area-inset-right)',
      }}
    >
      <div className="flex items-stretch px-1">
        {itensBottomFinancas().map((item) => {
          const ativo = isNavAtivo(pathname, item);
          const Icone = ICONES[item.icone];
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={ativo ? 'page' : undefined}
              className={clsx(
                'relative flex min-h-[52px] min-w-[44px] flex-1 flex-col items-center justify-center gap-0.5 px-1 pb-1 pt-2 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent',
                ativo ? 'text-accent' : 'text-gray-500',
              )}
            >
              {ativo && <span aria-hidden="true" className="absolute left-1/2 top-0 h-[3px] w-7 -translate-x-1/2 rounded-full bg-accent" />}
              <Icone size={22} aria-hidden="true" />
              <span className="text-[11px] font-medium leading-tight">{item.label}</span>
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
          className="fixed bottom-16 left-0 right-0 z-modal mx-4 mb-2 rounded-2xl border border-white/10 bg-card p-3 shadow-2xl md:hidden"
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
                    ? 'bg-accent/20 text-white'
                    : 'text-gray-400 hover:bg-white/5'
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
        className="fixed bottom-0 left-0 right-0 z-nav border-t border-white/10 bg-card/95 backdrop-blur-xl md:hidden"
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
