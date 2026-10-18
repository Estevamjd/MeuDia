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

/** Lado de transferência cujo banco foi excluído (007: origem_id/destino_id NULL). */
export const BANCO_EXCLUIDO = 'banco excluído';

type LadosTransferencia = { origem_id: string | null; destino_id: string | null };

/** "Nubank → Caixa"; o lado excluído vira "banco excluído". */
export function rotuloTransferencia(tr: LadosTransferencia, nomes: ReadonlyMap<string, string>): string {
  const nome = (id: string | null) => (id && nomes.get(id)) || BANCO_EXCLUIDO;
  return `${nome(tr.origem_id)} → ${nome(tr.destino_id)}`;
}

export function detalheExclusaoTransferencia(tr: LadosTransferencia): string {
  return tr.origem_id && tr.destino_id
    ? 'Os dois bancos voltam ao saldo de antes da transferência.'
    : 'O banco que sobrou volta ao saldo de antes da transferência.';
}

export function detalheExclusaoCarteira(nome: string, ultima: boolean): string {
  return `Os lançamentos de ${nome} ficam como "Sem banco" e o saldo dos outros bancos não muda. Transferências com ele ficam como "${BANCO_EXCLUIDO}".${
    ultima ? ' É o seu último banco: o Cofrinho volta a pedir onde fica seu dinheiro.' : ''
  }`;
}
