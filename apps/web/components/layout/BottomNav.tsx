'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { useState } from 'react';
import { useAppMode } from '../AppModeProvider';
import { LancamentoRapidoSheet } from '../financas/LancamentoRapidoSheet';
import {
  BOTTOM_TABS_PADRAO,
  MENU_MAIS_PADRAO,
  isNavAtivo,
  itensBottomFinancas,
} from '../../lib/navegacao';

const TABS_PRINCIPAIS = BOTTOM_TABS_PADRAO;
const MENU_MAIS = MENU_MAIS_PADRAO;

interface BottomNavProps {
  /** Abre o AgentPanel do layout (item "Chat" do modo Finanças). */
  onOpenChat?: () => void;
  chatAberto?: boolean;
}

export function BottomNav({ onOpenChat, chatAberto = false }: BottomNavProps) {
  const mode = useAppMode();
  return mode === 'financas' ? (
    <BottomNavFinancas onOpenChat={onOpenChat} chatAberto={chatAberto} />
  ) : (
    <BottomNavPadrao />
  );
}

const ITEM_CLASSES =
  'flex min-h-[44px] min-w-[44px] flex-1 flex-col items-center justify-center gap-0.5 rounded-lg px-1 py-1.5 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent';

function BottomNavFinancas({ onOpenChat, chatAberto }: BottomNavProps) {
  const pathname = usePathname();
  const [acoesAbertas, setAcoesAbertas] = useState(false);
  return (
    <>
    <LancamentoRapidoSheet open={acoesAbertas} onClose={() => setAcoesAbertas(false)} />
    <nav
      aria-label="Navegação principal"
      className="fixed bottom-0 left-0 right-0 z-40 border-t border-white/10 bg-card/95 backdrop-blur-xl md:hidden"
      style={{
        paddingBottom: 'env(safe-area-inset-bottom)',
        paddingLeft: 'env(safe-area-inset-left)',
        paddingRight: 'env(safe-area-inset-right)',
      }}
    >
      <div className="flex items-center gap-1 px-2 py-1">
        {itensBottomFinancas().map((item) => {
          if (item.tipo === 'chat') {
            if (!onOpenChat) return null;
            return (
              <button
                key="chat"
                type="button"
                onClick={onOpenChat}
                aria-haspopup="dialog"
                aria-expanded={chatAberto}
                className={`${ITEM_CLASSES} ${chatAberto ? 'text-accent' : 'text-gray-500'}`}
              >
                <span className="text-xl" aria-hidden="true">{item.emoji}</span>
                <span className="text-[10px] font-medium">{item.label}</span>
              </button>
            );
          }

          if (item.tipo === 'acoes') {
            return (
              <button
                key="acoes"
                type="button"
                onClick={() => setAcoesAbertas(true)}
                aria-label={item.label}
                aria-haspopup="dialog"
                aria-expanded={acoesAbertas}
                className="flex min-h-[44px] min-w-[44px] flex-1 items-center justify-center rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
              >
                <span
                  aria-hidden="true"
                  className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-accent to-accent2 text-2xl font-bold leading-none text-white shadow-[0_4px_16px_rgba(124,106,255,0.4)]"
                >
                  {item.emoji}
                </span>
              </button>
            );
          }

          const ativo = isNavAtivo(pathname, item);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={ativo ? 'page' : undefined}
              className={`${ITEM_CLASSES} ${ativo ? 'text-accent' : 'text-gray-500'}`}
            >
              <span className="text-xl" aria-hidden="true">{item.emoji}</span>
              <span className="text-[10px] font-medium">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
    </>
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
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm md:hidden"
          onClick={() => setMaisAberto(false)}
        />
      )}

      {/* Menu Mais expandido */}
      {maisAberto && (
        <div
          className="fixed bottom-16 left-0 right-0 z-50 mx-4 mb-2 rounded-2xl border border-white/10 bg-card p-3 shadow-2xl md:hidden"
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
        className="fixed bottom-0 left-0 right-0 z-40 border-t border-white/10 bg-card/95 backdrop-blur-xl md:hidden"
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
