import type { TipoCarteira } from '@meudia/shared';

export const TIPO_CARTEIRA_LABEL: Record<TipoCarteira, string> = {
  banco: 'Banco',
  dinheiro: 'Dinheiro',
  poupanca: 'Poupança',
};

export const OLHO_KEY = 'meudia:esconder-valores';

/** Preferência do "olho" (esconder valores); sem storage, mostra. */
export function lerEsconderValores(): boolean {
  try {
    return localStorage.getItem(OLHO_KEY) === '1';
  } catch {
    return false;
  }
}

export function salvarEsconderValores(esconder: boolean) {
  try {
    localStorage.setItem(OLHO_KEY, esconder ? '1' : '0');
  } catch {
    // Modo privado: vale só nesta sessão.
  }
}

/** Valor escondido pelo olho: mesmo formato visual, sem revelar o número. */
export const VALOR_OCULTO = 'R$ •••••';

/** Máscara BRL com sinal: o usuário marca "está negativo" à parte (o teclado decimal do iPhone não tem "−"). */
export function comSinal(valor: number, negativo: boolean): number {
  return negativo ? -Math.abs(valor) : Math.abs(valor);
}
