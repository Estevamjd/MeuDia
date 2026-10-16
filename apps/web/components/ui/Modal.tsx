'use client';

import { useEffect, useRef, useCallback, type ReactNode } from 'react';
import { clsx } from 'clsx';
import { X } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  className?: string;
}

export function Modal({ isOpen, onClose, title, children, className }: ModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  // Callers costumam passar `onClose` inline: guardado em ref para o efeito de
  // abertura não re-rodar a cada render do pai (re-focava o 1º campo a cada tecla).
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      onCloseRef.current();
      return;
    }

    // Focus trap
    if (e.key === 'Tab' && contentRef.current) {
      const focusable = contentRef.current.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    }
  }, []);

  // Só depende de `isOpen`: autofoco roda uma vez por abertura.
  useEffect(() => {
    if (!isOpen) return;

    const anterior = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';

    // Focar no primeiro elemento focável (se o usuário ainda não focou outro campo)
    const timer = setTimeout(() => {
      if (contentRef.current?.contains(document.activeElement)) return;
      const first = contentRef.current?.querySelector<HTMLElement>(
        'input, select, textarea, button:not([data-close])',
      );
      first?.focus();
    }, 100);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
      clearTimeout(timer);
      // Devolve o foco a quem abriu o modal (se ainda estiver na página).
      if (anterior?.isConnected) anterior.focus();
    };
  }, [isOpen, handleKeyDown]);

  if (!isOpen) return null;

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={(e) => e.target === overlayRef.current && onClose()}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" aria-hidden="true" />
      <div
        ref={contentRef}
        className={clsx(
          'animate-fadeSlide relative z-10 w-full max-w-md rounded-card border border-border bg-card p-6',
          className,
        )}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 id="modal-title" className="font-syne text-lg font-bold text-text">
            {title}
          </h2>
          <button
            data-close
            onClick={onClose}
            className="rounded-lg p-1 text-muted transition-colors hover:bg-card2 hover:text-text"
            aria-label="Fechar modal"
          >
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
