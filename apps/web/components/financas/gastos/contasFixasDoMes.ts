import type { ContaFixaDoMes, OcorrenciaConta, Transacao } from '@meudia/shared';

const centavos = (n: number) => Math.round(n * 100) / 100 + 0;

export interface ContasFixasDoMes {
  itens: ContaFixaDoMes[];
  total: number;
  pagas: number;
  aPagar: number;
}

/**
 * Contas fixas do mês para a tela Gastos: todas, pagas ou não (mesma regra da Início).
 * Paga usa o valor do "Paguei" quando o lançamento está na lista; senão, o valor cadastrado.
 */
export function contasFixasDoMes(ocorrencias: readonly OcorrenciaConta[], transacoes: readonly Pick<Transacao, 'id' | 'valor'>[], categoria: string | null = null): ContasFixasDoMes {
  const valorDe = new Map(transacoes.map((t) => [t.id, Number(t.valor)]));
  const itens = ocorrencias
    .filter((o) => !categoria || o.conta.categoria === categoria)
    .map((o): ContaFixaDoMes => {
      const tid = o.pagamento?.transacao_id;
      return {
        id: o.conta.id, descricao: o.conta.descricao, categoria: o.conta.categoria,
        valor: centavos((tid ? valorDe.get(tid) : undefined) ?? Number(o.conta.valor)),
        vencimento: o.vencimento, paga: !!o.pagamento, pagoEm: o.pagamento?.pago_em?.slice(0, 10) ?? null,
      };
    })
    .sort((a, b) => a.vencimento.localeCompare(b.vencimento) || a.descricao.localeCompare(b.descricao));
  const pagas = itens.filter((c) => c.paga).length;
  return { itens, total: centavos(itens.reduce((s, c) => s + c.valor, 0)), pagas, aPagar: itens.length - pagas };
}
