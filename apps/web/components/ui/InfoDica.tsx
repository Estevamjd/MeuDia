'use client';

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent, type SyntheticEvent } from 'react';
import { createPortal } from 'react-dom';
import { clsx } from 'clsx';
import { Info, X } from 'lucide-react';

export interface InfoDicaProps {
  /** Nome do número explicado ("Pode gastar por dia"): vira "O que é <rótulo>?" e o título da explicação. */
  rotulo: string;
  /** Explicação curta (1–2 frases), de components/financas/home/explicacoes.ts. */
  texto: string;
  /**
   * Área de toque (sempre 44 de largura). `quadrado` = 44×44. Nas linhas empilhadas a cada 24px (a conta do cartão
   * Ritmo), a altura é a da linha, para não cobrir o ⓘ vizinho: `linha` = 24 (linhas do meio), `linha-topo` = 44 (a
   * 1ª, que cresce para cima, sobre texto sem ação), `linha-base` = 37 (a última, que cresce para baixo até a borda do cartão).
   */
  alvo?: AlvoInfoDica;
  /** Cor do ícone (padrão: texto secundário do app). */
  className?: string;
}

export type AlvoInfoDica = 'quadrado' | 'linha' | 'linha-topo' | 'linha-base';

/** Inset vertical do ::before (o desenho tem 14px): literais para o Tailwind achar. */
const ALVO_Y: Record<AlvoInfoDica, string> = {
  quadrado: 'before:-inset-y-[15px]',
  linha: 'before:-inset-y-[5px]',
  'linha-topo': 'before:-top-[25px] before:-bottom-[5px]',
  'linha-base': 'before:-top-[5px] before:-bottom-[18px]',
};

/** Margem mínima da explicação até a borda da tela. */
const MARGEM = 12;
const LARGURA_MAX = 300;
const ESPACO = 8;
/** Embaixo fica a BottomNav (≈ 64px + safe area no celular): a caixa não desce sobre ela; se não couber, abre em cima. */
const RESERVA_BAIXO = 96;

/** Corta a propagação direto no DOM: o trilho do maço escuta toque/ponteiro nativo, antes do React (igual ao "+ Guardei"). */
function useCortarToque<T extends HTMLElement>(ref: React.RefObject<T | null>, ativo: boolean) {
  useEffect(() => {
    const el = ref.current;
    if (!el || !ativo) return;
    const parar = (e: Event) => e.stopPropagation();
    const eventos = ['pointerdown', 'touchstart', 'touchend', 'touchcancel'] as const;
    for (const ev of eventos) el.addEventListener(ev, parar, { passive: true });
    return () => {
      for (const ev of eventos) el.removeEventListener(ev, parar);
    };
  }, [ref, ativo]);
}

/**
 * ⓘ discreto ao lado de um número: o toque abre uma explicação curta ancorada nele. A explicação vai num portal no
 * `body` (o cartão do maço corta o que passa da borda e tem transform), com posição fixa calculada a partir do botão:
 * embaixo se couber, senão em cima. Fecha no X, no Esc (foco volta ao ⓘ), no toque fora e ao rolar a página.
 * Não passa o cartão: toque e clique param no botão e `touch-pan-y` só deixa a página rolar na vertical.
 */
export function InfoDica({ rotulo, texto, alvo = 'quadrado', className = 'text-muted' }: InfoDicaProps) {
  const [aberto, setAberto] = useState(false);
  const [pos, setPos] = useState<CSSProperties | null>(null);
  const botaoRef = useRef<HTMLButtonElement>(null);
  const caixaRef = useRef<HTMLDivElement>(null);
  const id = useId();
  const idTitulo = `${id}-titulo`;

  useCortarToque(botaoRef, true);
  useCortarToque(caixaRef, aberto);

  const fechar = useCallback((devolverFoco: boolean) => {
    setAberto(false);
    setPos(null);
    if (devolverFoco) botaoRef.current?.focus();
  }, []);

  // Posição: mede a caixa já montada (invisível) e decide em cima/embaixo antes da pintura.
  const posicionar = useCallback(() => {
    const b = botaoRef.current?.getBoundingClientRect();
    const caixa = caixaRef.current;
    if (!b || !caixa) return;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const largura = Math.min(LARGURA_MAX, vw - MARGEM * 2);
    const altura = caixa.offsetHeight;
    const centro = b.left + b.width / 2;
    const left = Math.min(Math.max(centro - largura / 2, MARGEM), vw - largura - MARGEM);
    const cabeEmbaixo = b.bottom + ESPACO + altura <= vh - (vw < 768 ? RESERVA_BAIXO : MARGEM);
    const top = cabeEmbaixo || b.top - ESPACO - altura < MARGEM ? b.bottom + ESPACO : b.top - ESPACO - altura;
    setPos({ left, top, width: largura });
  }, []);

  useLayoutEffect(() => {
    if (aberto) posicionar();
  }, [aberto, posicionar]);

  // Foco na caixa só depois de posicionada: com `visibility: hidden` (a 1ª pintura, medindo) o WebKit ignora o focus().
  // Uma vez por abertura (o resize reposiciona e não pode tirar o foco do X).
  const focou = useRef(false);
  useEffect(() => {
    if (!aberto) {
      focou.current = false;
      return;
    }
    if (pos && !focou.current) {
      focou.current = true;
      caixaRef.current?.focus({ preventScroll: true });
    }
  }, [aberto, pos]);

  useEffect(() => {
    if (!aberto) return;
    const tecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        fechar(true);
      }
    };
    const fora = (e: PointerEvent) => {
      const alvo = e.target as Node;
      if (caixaRef.current?.contains(alvo) || botaoRef.current?.contains(alvo)) return;
      fechar(false);
    };
    // A caixa é fixa: rolar a página a deixaria longe do número; fecha (sem roubar o foco de quem rola).
    const rolou = (e: Event) => {
      if (caixaRef.current?.contains(e.target as Node)) return;
      fechar(false);
    };
    document.addEventListener('keydown', tecla);
    document.addEventListener('pointerdown', fora, true);
    window.addEventListener('scroll', rolou, true);
    window.addEventListener('resize', posicionar);
    return () => {
      document.removeEventListener('keydown', tecla);
      document.removeEventListener('pointerdown', fora, true);
      window.removeEventListener('scroll', rolou, true);
      window.removeEventListener('resize', posicionar);
    };
  }, [aberto, fechar, posicionar]);

  // Eventos React atravessam o portal até os pais (Link, trilho do maço): param aqui.
  const parar = (e: SyntheticEvent) => e.stopPropagation();
  // O `parar` do teclado também barra o Esc antes do listener do `document`: o Esc com o foco na caixa (ou no X, ou no
  // ⓘ) é tratado aqui mesmo.
  const teclaLocal = (e: ReactKeyboardEvent) => {
    e.stopPropagation();
    if (e.key === 'Escape' && aberto) {
      e.preventDefault();
      fechar(true);
    }
  };

  return (
    <>
      <button
        ref={botaoRef}
        type="button"
        aria-label={`O que é ${rotulo}?`}
        aria-expanded={aberto}
        aria-controls={aberto ? id : undefined}
        data-testid="info-dica"
        onClick={(e) => {
          e.stopPropagation();
          e.preventDefault();
          if (aberto) fechar(false);
          else setAberto(true);
        }}
        onKeyDown={teclaLocal}
        className={clsx(
          // Desenho de 14px; a área de toque vem do ::before (44 de largura; altura conforme `alvo`) sem mexer no layout.
          "pointer-events-auto relative inline-flex h-3.5 w-3.5 shrink-0 touch-pan-y items-center justify-center rounded-full opacity-80 before:absolute before:-inset-x-[15px] before:content-[''] hover:opacity-100 focus-visible:opacity-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
          ALVO_Y[alvo],
          aberto && 'opacity-100',
          className,
        )}
      >
        <Info size={14} strokeWidth={2} aria-hidden="true" />
      </button>
      {aberto &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            ref={caixaRef}
            id={id}
            role="dialog"
            aria-modal="false"
            aria-labelledby={idTitulo}
            tabIndex={-1}
            data-testid="info-dica-caixa"
            onClick={parar}
            onPointerDown={parar}
            onKeyDown={teclaLocal}
            style={pos ?? { left: MARGEM, top: 0, width: Math.min(LARGURA_MAX, window.innerWidth - MARGEM * 2), visibility: 'hidden' }}
            className="fixed z-modal rounded-xl border border-border bg-card py-2.5 pl-3 pr-11 text-left shadow-[0_12px_32px_-12px_rgb(0_0_0/0.45)] outline-none"
          >
            <p id={idTitulo} className="flex items-center gap-1.5 text-[13px] font-semibold leading-tight text-text">
              <Info size={14} aria-hidden="true" className="shrink-0 text-accent" />
              {rotulo}
            </p>
            <p className="mt-1 text-[13px] leading-snug text-muted">{texto}</p>
            <button
              type="button"
              onClick={() => fechar(true)}
              aria-label="Fechar explicação"
              className="absolute right-0 top-0 inline-flex h-11 w-11 items-center justify-center rounded-xl text-muted hover:text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-4px] focus-visible:outline-accent"
            >
              <X size={16} aria-hidden="true" />
            </button>
          </div>,
          document.body,
        )}
    </>
  );
}
