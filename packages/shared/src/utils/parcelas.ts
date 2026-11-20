export const PARCELAS_MAX = 24;

export interface ParcelaPlanejada {
  parcela_num: number;
  valor: number;
  data: string;
}

/** Planeja por centavos inteiros e sempre ancora o dia na data original da compra. */
export function dividirParcelas(total: number, parcelas: number, dataPrimeira: string): ParcelaPlanejada[] {
  if (!Number.isInteger(parcelas) || parcelas < 2 || parcelas > PARCELAS_MAX) {
    throw new Error(`Escolha de 2 a ${PARCELAS_MAX} parcelas inteiras.`);
  }
  const centavos = Math.round(total * 100);
  // Comparação em reais evita rejeitar valores como 0,29 pelo ruído de total * 100.
  if (!Number.isFinite(total) || total <= 0 || !Number.isSafeInteger(centavos) || centavos / 100 !== total) {
    throw new Error('O valor total deve ser positivo e ter no máximo duas casas decimais.');
  }
  if (centavos < parcelas) {
    throw new Error('O valor total precisa ser de pelo menos R$ 0,01 por parcela.');
  }
  const primeira = new Date(`${dataPrimeira}T00:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dataPrimeira) || !Number.isFinite(primeira.getTime()) || primeira.toISOString().slice(0, 10) !== dataPrimeira) {
    throw new Error('Informe uma data válida para a primeira parcela.');
  }
  const valorBase = Math.floor(centavos / parcelas);
  const resto = centavos % parcelas;
  return Array.from({ length: parcelas }, (_, i) => {
    const mes = new Date(primeira);
    mes.setUTCDate(1);
    mes.setUTCMonth(mes.getUTCMonth() + i + 1);
    mes.setUTCDate(0);
    mes.setUTCDate(Math.min(primeira.getUTCDate(), mes.getUTCDate()));
    return { parcela_num: i + 1, valor: (valorBase + (i === 0 ? resto : 0)) / 100, data: mes.toISOString().slice(0, 10) };
  });
}

export function rotuloParcela(t: { parcela_num?: number | null; parcela_total?: number | null }): string | null {
  return t.parcela_num != null && t.parcela_total != null && Number.isInteger(t.parcela_num) && Number.isInteger(t.parcela_total) && t.parcela_num >= 1 && t.parcela_num <= t.parcela_total ? `${t.parcela_num}/${t.parcela_total}` : null;
}
