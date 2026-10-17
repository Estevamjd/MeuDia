import { useEffect } from 'react';

/**
 * Trava o scroll do body enquanto `ativo`. No iOS `overflow: hidden` no body não basta (o Safari
 * continua rolando a página por trás): fixa o body na posição atual e devolve o scroll ao destravar.
 */
export function useTravaScroll(ativo: boolean) {
  useEffect(() => {
    if (!ativo) return;
    const { style } = document.body;
    const y = window.scrollY;
    const anterior = { overflow: style.overflow, position: style.position, top: style.top, width: style.width };
    style.overflow = 'hidden';
    style.position = 'fixed';
    style.top = `-${y}px`;
    style.width = '100%';
    return () => {
      Object.assign(style, anterior);
      if (y) window.scrollTo(0, y);
    };
  }, [ativo]);
}
