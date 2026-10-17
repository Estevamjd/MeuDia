import type { KeyboardEvent } from 'react';

export function radioTeclado(e: KeyboardEvent<HTMLButtonElement>, selecionar: (indice: number) => void) {
  const botoes = Array.from(e.currentTarget.parentElement!.querySelectorAll<HTMLButtonElement>('[role="radio"]:not(:disabled)'));
  const atual = botoes.indexOf(e.currentTarget);
  let proximo: number;
  switch (e.key) {
    case 'Enter': case ' ': e.preventDefault(); e.currentTarget.click(); return;
    case 'ArrowRight': case 'ArrowDown': proximo = (atual + 1) % botoes.length; break;
    case 'ArrowLeft': case 'ArrowUp': proximo = (atual - 1 + botoes.length) % botoes.length; break;
    case 'Home': proximo = 0; break;
    case 'End': proximo = botoes.length - 1; break;
    default: return;
  }
  e.preventDefault();
  botoes[proximo]!.focus();
  selecionar(proximo);
}
