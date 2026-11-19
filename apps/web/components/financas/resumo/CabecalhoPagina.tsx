import type { ReactNode } from 'react';
import { clsx } from 'clsx';

interface CabecalhoPaginaProps {
  titulo: ReactNode;
  /** Linha de contexto abaixo do título (mês, explicação curta). */
  contexto?: ReactNode;
  /** Ações à direita (olho, Lançar...). */
  acoes?: ReactNode;
  /** Rótulo em mono ciano acima do título (Relatório). */
  marca?: string;
  className?: string;
}

/** Cabeçalho das telas do design v2: título grande e leve (32px/300), contexto em cinza e ações redondas. */
export function CabecalhoPagina({ titulo, contexto, acoes, marca, className }: CabecalhoPaginaProps) {
  return (
    <header className={clsx('flex items-start justify-between gap-3', className)}>
      <div className="min-w-0">
        {marca && <p className="lap-rotulo mb-2 text-accent">{marca}</p>}
        <h1 className="break-words font-dm text-[32px] font-light leading-10 tracking-[-0.035em] text-text">{titulo}</h1>
        {contexto && <div className="mt-1 text-[13px] leading-[18px] text-muted">{contexto}</div>}
      </div>
      {acoes && <div className="flex shrink-0 items-center gap-2 pt-1">{acoes}</div>}
    </header>
  );
}

/** Botão redondo de 36px (alvo de 44px) com luz no topo, como o sino do mock. */
export const BOTAO_REDONDO =
  'relative grid h-9 w-9 place-items-center rounded-full border border-border bg-card text-text shadow-[inset_0_1px_0_oklch(1_0_0/0.06),0_1px_2px_oklch(0_0_0/0.5)] transition-colors hover:bg-card2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent before:absolute before:-inset-1 before:content-[""]';

/** "Marina Souza" → "Marina"; vazio → `null` (o título vira só "Olá"). */
export function primeiroNome(nome: string | null | undefined): string | null {
  return nome?.trim().split(/\s+/)[0] || null;
}
