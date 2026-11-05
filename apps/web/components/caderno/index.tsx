'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { clsx } from 'clsx';

/**
 * Peças do visual B "Caderno" (Saúde e Treino, design-system §2–§4 e §7): sem cartão, seção com linha fina,
 * rótulo `lb`, link de texto, subabas e o vazio da tela 08. Carregamento e erro usam os componentes genéricos.
 */

/**
 * Raiz das telas do módulo: DM Sans do next/font (o `body` usa o nome literal 'DM Sans', que só existe se estiver
 * instalada no aparelho). `geometricPrecision`: sem ele, o Chromium arredonda o avanço dos glifos da webfont em
 * tamanho pequeno e abre buracos no meio da palavra ("edit ar", "AN TERIOR", "CALORI AS"; QA R1).
 */
export const classeTextoCaderno = 'font-dm [text-rendering:geometricPrecision]';

export function TelaCaderno({ children }: { children: ReactNode }) {
  // -mx-4 no celular: as linhas finas vão de ponta a ponta, com a margem de 20px do Caderno dentro de cada seção.
  return <div className={clsx('-mx-4 max-w-2xl md:mx-0', classeTextoCaderno)}>{children}</div>;
}

export function Cabecalho({ titulo, contexto }: { titulo: string; contexto?: ReactNode }) {
  return (
    <header className="flex items-end justify-between gap-3 px-5 pb-3 pt-4">
      <h1 className="font-syne text-[30px] font-extrabold leading-none tracking-[-0.5px] text-text">{titulo}</h1>
      {contexto !== undefined && (
        <p className="truncate text-[12px] uppercase tracking-[1.6px] text-muted-text tabular-nums">{contexto}</p>
      )}
    </header>
  );
}

export const SUBABAS_SAUDE = [
  { href: '/saude', label: 'Hoje' },
  { href: '/treinos', label: 'Treino' },
  { href: '/saude/dieta', label: 'Dieta' },
  { href: '/saude/peso', label: 'Peso' },
] as const;

/** Hoje · Treino · Dieta · Peso. Ativa: --text 700 com sublinhado de 2px --accent3; linha de 1px embaixo de todas. */
export function Subabas() {
  const pathname = usePathname() ?? '';
  return (
    <nav aria-label="Saúde e treino" className="border-b border-white/[0.07] px-5">
      <ul className="flex gap-7">
        {SUBABAS_SAUDE.map((aba) => {
          const ativa = pathname === aba.href;
          return (
            <li key={aba.href}>
              <Link
                href={aba.href}
                aria-current={ativa ? 'page' : undefined}
                className={clsx(
                  'relative inline-flex min-h-11 items-center whitespace-nowrap text-[14px] tracking-normal focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent3',
                  ativa ? 'font-bold text-text' : 'text-muted-text hover:text-text',
                )}
              >
                {aba.label}
                {ativa && <span aria-hidden="true" className="absolute inset-x-0 -bottom-px h-[2px] bg-accent3" />}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Rótulo `lb`: 10,5px maiúsculas, letter-spacing 1,6px, --muted-text. */
export function Rotulo({ children, id, className }: { children: ReactNode; id?: string; className?: string }) {
  return (
    <p id={id} className={clsx('text-[10.5px] uppercase tracking-[1.6px] text-muted-text', className)}>
      {children}
    </p>
  );
}

export function Secao({ children, rotulo, className }: { children: ReactNode; rotulo?: ReactNode; className?: string }) {
  return (
    <section className={clsx('border-b border-white/[0.07] px-5 py-[18px]', className)}>
      {rotulo !== undefined && <Rotulo className="mb-2">{rotulo}</Rotulo>}
      {children}
    </section>
  );
}

/**
 * Link de texto (--accent3 700): "editar", "+ série", "duplicar". DM Sans com letter-spacing normal e sem quebra:
 * no Chromium 390 a fonte do sistema abria "editar" em "edit ar" (QA R1).
 */
export function LinkAcao({
  onClick,
  children,
  disabled,
  ariaLabel,
}: {
  onClick: () => void;
  children: ReactNode;
  disabled?: boolean;
  ariaLabel?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      className="min-h-11 whitespace-nowrap font-dm text-[14px] font-bold tracking-normal text-accent3 [text-rendering:geometricPrecision] disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent3"
    >
      {children}
    </button>
  );
}

export const classeBotaoCheio =
  'inline-flex min-h-11 w-full items-center justify-center rounded bg-accent3 px-5 py-[13px] font-dm text-[14px] font-bold tracking-normal text-[#04201a] disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent3';

export const classeBotaoContorno =
  'inline-flex min-h-11 items-center justify-center whitespace-nowrap rounded border-[1.5px] border-accent3 px-4 font-dm text-[14px] font-bold tracking-normal text-accent3 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent3';

/** Chip (7/30/90 dias, ritmo, sexo, objetivo): ativo com borda e texto --accent3. */
export function Chip({ ativo, onClick, children }: { ativo: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={ativo}
      onClick={onClick}
      className={clsx(
        'min-h-11 whitespace-nowrap rounded border px-4 font-dm text-[14px] tracking-normal focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent3',
        ativo ? 'border-[1.5px] border-accent3 font-bold text-accent3' : 'border-white/[0.14] text-text',
      )}
    >
      {children}
    </button>
  );
}

/**
 * Vazio do Caderno (tela 08): rótulo, uma frase, uma linha de explicação e o botão cheio com a ação.
 * Sem ícone, sem gradiente. `acao` como link (`href`) ou botão (`onAcao`).
 */
export function VazioCaderno({
  rotulo,
  titulo,
  explicacao,
  acao,
  href,
  onAcao,
}: {
  rotulo: string;
  titulo: string;
  explicacao: string;
  acao?: string;
  href?: string;
  onAcao?: () => void;
}) {
  return (
    <section className="border-b border-white/[0.07] px-5 pb-7 pt-8" data-vazio-caderno="">
      <Rotulo>{rotulo}</Rotulo>
      <h2 className="mt-1.5 font-syne text-[22px] font-bold leading-tight text-text">{titulo}</h2>
      <p className="mt-1.5 text-[14.5px] text-muted-text">{explicacao}</p>
      {acao && href && (
        <Link href={href} className={clsx(classeBotaoCheio, 'mt-5')}>
          {acao}
        </Link>
      )}
      {acao && !href && onAcao && (
        <button type="button" onClick={onAcao} className={clsx(classeBotaoCheio, 'mt-5')}>
          {acao}
        </button>
      )}
    </section>
  );
}
