'use client';

import { useCallback, useEffect, useRef, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { X, LogOut } from 'lucide-react';
import { useAppMode } from '../AppModeProvider';
import { isNavAtivo, itensDrawer } from '../../lib/navegacao';

const FOCAVEIS = 'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';
/** Breakpoint `md` do Tailwind. */
const MEDIA_DESKTOP = '(min-width: 768px)';

interface NavDrawerProps {
  id: string;
  isOpen: boolean;
  onClose: () => void;
  onSignOut: () => void;
  /** Botão que abriu o drawer; recebe o foco de volta ao fechar. */
  returnFocusRef: RefObject<HTMLElement>;
}

/** Menu lateral mobile (modo Finanças): dialog modal com focus trap. */
export function NavDrawer({ id, isOpen, onClose, onSignOut, returnFocusRef }: NavDrawerProps) {
  const pathname = usePathname();
  const itens = itensDrawer(useAppMode());
  const painelRef = useRef<HTMLDivElement>(null);
  const pathnameAnterior = useRef(pathname);

  // Fecha ao navegar (inclui voltar/avançar do navegador).
  useEffect(() => {
    if (pathnameAnterior.current !== pathname && isOpen) onClose();
    pathnameAnterior.current = pathname;
  }, [pathname, isOpen, onClose]);

  // O drawer é só mobile (md:hidden): ao passar para >= md, fecha para liberar
  // listener, focus trap e o overflow do body.
  useEffect(() => {
    if (!isOpen || typeof window.matchMedia !== 'function') return;
    const mql = window.matchMedia(MEDIA_DESKTOP);
    if (mql.matches) {
      onClose();
      return;
    }
    const handleChange = (e: MediaQueryListEvent) => {
      if (e.matches) onClose();
    };
    mql.addEventListener('change', handleChange);
    return () => mql.removeEventListener('change', handleChange);
  }, [isOpen, onClose]);

  // `onClose` em ref: o efeito de foco não re-roda (nem rouba o foco) se o pai
  // passar um callback novo a cada render.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onCloseRef.current();
      return;
    }
    if (e.key !== 'Tab' || !painelRef.current) return;
    const focaveis = Array.from(painelRef.current.querySelectorAll<HTMLElement>(FOCAVEIS));
    const primeiro = focaveis[0];
    const ultimo = focaveis[focaveis.length - 1];
    if (!primeiro || !ultimo) return;
    const ativo = document.activeElement;
    const dentro = painelRef.current.contains(ativo);
    if (e.shiftKey && (ativo === primeiro || !dentro)) {
      e.preventDefault();
      ultimo.focus();
    } else if (!e.shiftKey && (ativo === ultimo || !dentro)) {
      e.preventDefault();
      primeiro.focus();
    }
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const botao = returnFocusRef.current;
    document.addEventListener('keydown', handleKeyDown);
    const overflowAnterior = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    painelRef.current?.querySelector<HTMLElement>(FOCAVEIS)?.focus();

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = overflowAnterior;
      botao?.focus();
    };
    // returnFocusRef é um ref (identidade estável); lido só na abertura.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, handleKeyDown]);

  if (!isOpen) return null;

  // Portal: o layout cria stacking context (z-10) e o Topbar tem backdrop-filter;
  // no body o drawer fica acima da BottomNav e não é preso pelo `fixed` do pai.
  return createPortal(
    <div className="md:hidden">
      <div
        className="fixed inset-0 z-modal bg-black/50 backdrop-blur-sm"
        aria-hidden="true"
        onClick={onClose}
        data-testid="nav-drawer-overlay"
      />
      <div
        ref={painelRef}
        id={id}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${id}-titulo`}
        className="fixed inset-y-0 left-0 z-modal flex w-[min(85vw,300px)] flex-col overflow-y-auto border-r border-border bg-surface shadow-2xl"
        style={{
          paddingTop: 'max(1rem, env(safe-area-inset-top))',
          paddingBottom: 'max(1rem, env(safe-area-inset-bottom))',
          paddingLeft: 'max(0.75rem, env(safe-area-inset-left))',
          paddingRight: '0.75rem',
        }}
      >
        <div className="mb-4 flex items-center justify-between gap-2 pl-2">
          <h2 id={`${id}-titulo`} className="font-syne text-lg font-bold text-text">
            ✦ MeuDia
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar menu"
            className="flex h-11 w-11 items-center justify-center rounded-lg text-muted transition-colors hover:bg-card2 hover:text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        <nav aria-label="Menu" className="flex-1">
          <ul className="flex flex-col gap-1">
            {itens.map((item) => {
              const ativo = isNavAtivo(pathname, item);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onClose}
                    aria-current={ativo ? 'page' : undefined}
                    className={`flex min-h-[44px] items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent ${
                      ativo ? 'bg-accent/15 text-accent' : 'text-muted hover:bg-card hover:text-text'
                    }`}
                  >
                    <span className="w-6 text-center text-lg" aria-hidden="true">
                      {item.emoji}
                    </span>
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <button
          type="button"
          onClick={() => {
            onClose();
            onSignOut();
          }}
          className="mt-4 flex min-h-[44px] items-center gap-3 rounded-lg px-3 text-left text-sm font-medium text-muted transition-colors hover:bg-red/10 hover:text-red focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
        >
          <LogOut size={18} className="w-6" aria-hidden="true" />
          Sair
        </button>
      </div>
    </div>,
    document.body,
  );
}
