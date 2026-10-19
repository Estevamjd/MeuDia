import { clsx } from 'clsx';
import type { ReactNode } from 'react';

interface CardDashboardProps {
  id: string;
  titulo: string;
  /** Ícone no quadrado colorido suave à direita (padrão StockFlow). */
  icone?: ReactNode;
  /** Classes de cor do quadrado (ex.: `bg-green/[0.14] text-green`). */
  corIcone?: string;
  children: ReactNode;
  className?: string;
  acao?: ReactNode;
  /** Início (sem rolar em 390×844): menos respiro e sem o quadrado do ícone. */
  compacto?: boolean;
}

/** Card do dashboard: título pequeno, ícone à direita e conteúdo com valores grandes. */
export function CardDashboard({ id, titulo, icone, corIcone = 'bg-accent/[0.14] text-accent', children, className, acao, compacto = false }: CardDashboardProps) {
  return (
    <section
      aria-labelledby={id}
      className={clsx('min-w-0 rounded-xl border border-border bg-card', compacto ? 'space-y-2 px-4 py-3' : 'space-y-3 p-5', className)}
    >
      <div className={clsx('flex justify-between gap-3', compacto ? 'items-center' : 'items-start')}>
        <h2 id={id} className={clsx('text-[13px] font-medium text-muted', !compacto && 'pt-1')}>
          {titulo}
        </h2>
        <div className={clsx('flex shrink-0 items-center gap-1', compacto && '-my-3 -mr-2')}>
          {acao}
          {icone && !compacto && (
            <span aria-hidden="true" className={clsx('flex h-10 w-10 items-center justify-center rounded-xl', corIcone)}>
              {icone}
            </span>
          )}
        </div>
      </div>
      {children}
    </section>
  );
}

/** Fonte fluida dos valores-herói: cabe em 390px sem quebrar. */
export const VALOR_GRANDE = { fontSize: 'clamp(1.5rem, 8vw, 2rem)' } as const;
