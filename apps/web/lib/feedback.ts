/**
 * Toque curto de confirmação (tipo "haptic") quando algo é salvo. Só onde o navegador suporta (Android/Chrome);
 * no iPhone (Safari) a API não existe e nada acontece. Respeita "reduzir movimento".
 */
export function vibrarLeve(): void {
  if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return;
  if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
  try {
    navigator.vibrate(12);
  } catch {
    // Alguns navegadores bloqueiam sem gesto do usuário: sem problema.
  }
}

/** true quando o sistema pede menos movimento (ou o ambiente não sabe dizer, como em testes). */
export function preferirMenosMovimento(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return true;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
