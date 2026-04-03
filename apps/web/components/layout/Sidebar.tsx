'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { clsx } from 'clsx';

interface NavItem {
  href: string;
  label: string;
  emoji: string;
  colorClass?: 'green' | 'orange';
}

interface NavSection {
  label: string;
  items: NavItem[];
}

const navSections: NavSection[] = [
  {
    label: 'Geral',
    items: [
      { href: '/inicio',   label: 'Início',    emoji: '🏠' },
      { href: '/notas',    label: 'Notas',     emoji: '📝' },
      { href: '/agenda',   label: 'Agenda',    emoji: '📅' },
      { href: '/financas', label: 'Finanças',  emoji: '💸' },
      { href: '/compras',  label: 'Compras',   emoji: '🛒' },
      { href: '/habitos',  label: 'Hábitos',   emoji: '🔁' },
      { href: '/veiculo',      label: 'Veículo',      emoji: '🚗' },
      { href: '/assinaturas', label: 'Assinaturas', emoji: '💳' },
    ],
  },
  {
    label: 'Saúde',
    items: [
      { href: '/treinos', label: 'Treinos', emoji: '🏋️', colorClass: 'orange' },
      { href: '/dieta', label: 'Dieta', emoji: '🍽️', colorClass: 'green' },
      { href: '/medicamentos', label: 'Medicamentos', emoji: '💊' },
    ],
  },
];

interface SidebarProps {
  onSignOut: () => void;
  onNavigate?: () => void;
  onOpenAgent?: () => void;
  userName: string;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function Sidebar({ onSignOut, onNavigate, onOpenAgent, userName }: SidebarProps) {
  const pathname = usePathname();

  return (
    <aside
      className="sticky top-0 flex h-screen flex-col flex-shrink-0"
      style={{
        width: 230,
        background: 'var(--surface)',
        borderRight: '1px solid var(--border)',
        padding: '28px 14px',
        gap: 4,
      }}
    >
      {/* Logo */}
      <div
        className="font-syne"
        style={{
          fontSize: 22,
          fontWeight: 800,
          background: 'linear-gradient(135deg, var(--accent), var(--accent2))',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          marginBottom: 26,
          paddingLeft: 10,
          letterSpacing: -0.5,
        }}
      >
        <Link href="/inicio">✦ MeuDia</Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1">
        {navSections.map((section) => (
          <div key={section.label}>
            <div
              style={{
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: 1.5,
                color: 'var(--muted)',
                padding: '12px 10px 6px',
                textTransform: 'uppercase',
              }}
            >
              {section.label}
            </div>
            <div className="flex flex-col" style={{ gap: 1 }}>
              {section.items.map((item) => {
                const isActive = pathname === item.href || pathname.startsWith(item.href + '/');

                const activeStyles = (() => {
                  if (!isActive) return {};
                  if (item.colorClass === 'green') {
                    return {
                      background: 'rgba(74,222,128,0.13)',
                      color: 'var(--green)',
                      borderColor: 'rgba(74,222,128,0.22)',
                    };
                  }
                  if (item.colorClass === 'orange') {
                    return {
                      background: 'rgba(255,159,74,0.13)',
                      color: 'var(--orange)',
                      borderColor: 'rgba(255,159,74,0.22)',
                    };
                  }
                  return {
                    background: 'rgba(124,106,255,0.14)',
                    color: 'var(--accent)',
                    borderColor: 'rgba(124,106,255,0.22)',
                  };
                })();

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onNavigate}
                    className={clsx(
                      'flex items-center transition-all',
                      !isActive && 'hover:bg-[var(--card)]',
                    )}
                    style={{
                      gap: 11,
                      padding: '9px 12px',
                      borderRadius: 10,
                      fontSize: 13.5,
                      color: isActive ? activeStyles.color : 'var(--muted)',
                      fontWeight: 500,
                      border: '1px solid',
                      borderColor: isActive ? activeStyles.borderColor : 'transparent',
                      background: isActive ? activeStyles.background : 'transparent',
                      cursor: 'pointer',
                    }}
                  >
                    <span style={{ fontSize: 17, width: 22, textAlign: 'center' }}>
                      {item.emoji}
                    </span>
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Sidebar Footer */}
      <div
        style={{
          marginTop: 'auto',
          padding: 12,
          borderRadius: 12,
          background: 'var(--card)',
          border: '1px solid var(--border)',
        }}
      >
        <div className="flex items-center" style={{ gap: 10 }}>
          <div
            className="flex items-center justify-center"
            style={{
              width: 36,
              height: 36,
              borderRadius: '50%',
              background: 'linear-gradient(135deg, var(--accent), var(--accent2))',
              fontWeight: 700,
              fontSize: 14,
              color: '#fff',
              flexShrink: 0,
            }}
          >
            {userName.charAt(0).toUpperCase()}
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 500 }}>{userName}</div>
            <div style={{ fontSize: 11, color: 'var(--accent)' }}>✦ Pro Ativo</div>
          </div>
        </div>
        <Link
          href="/configuracoes"
          onClick={onNavigate}
          className="block w-full mt-2 text-left transition-all hover:text-text"
          style={{
            fontSize: 11,
            color: 'var(--muted)',
            padding: '4px 0',
          }}
        >
          ⚙️ Configuracoes
        </Link>
        <button
          onClick={onSignOut}
          className="w-full mt-1 text-left transition-all hover:text-red"
          style={{
            fontSize: 11,
            color: 'var(--muted)',
            padding: '4px 0 0',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
          }}
        >
          Sair
        </button>
      </div>
    </aside>
  );
}
