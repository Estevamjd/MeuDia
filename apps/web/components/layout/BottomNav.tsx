'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { useState } from 'react';

const TABS_PRINCIPAIS = [
  { href: '/inicio', label: 'Início', emoji: '🏠' },
  { href: '/agenda', label: 'Agenda', emoji: '📅' },
  { href: '/habitos', label: 'Hábitos', emoji: '✅' },
  { href: '/financas', label: 'Finanças', emoji: '💰' },
  { href: '/mais', label: 'Mais', emoji: '⋯' },
];

const MENU_MAIS = [
  { href: '/treinos', label: 'Treinos', emoji: '🏋️' },
  { href: '/dieta', label: 'Dieta', emoji: '🍽️' },
  { href: '/medicamentos', label: 'Medicamentos', emoji: '💊' },
  { href: '/notas', label: 'Notas', emoji: '📝' },
  { href: '/compras', label: 'Compras', emoji: '🛒' },
  { href: '/veiculo', label: 'Veículo', emoji: '🚗' },
  { href: '/assinaturas', label: 'Assinaturas', emoji: '💳' },
  { href: '/configuracoes', label: 'Config', emoji: '⚙️' },
];

export function BottomNav() {
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
