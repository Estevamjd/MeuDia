import { describe, expect, it } from 'vitest';
import type { ContaPagar, OcorrenciaConta } from '@meudia/shared';
import { contasFixasDoMes } from '../contasFixasDoMes';

const conta = (id: string, descricao: string, valor: number, categoria = 'Contas'): ContaPagar => ({
  id, user_id: 'u', assinatura_id: null, descricao, categoria, valor, recorrencia: 'mensal', dia_vencimento: 5,
  mes_vencimento: null, data_vencimento: null, ativo: true, created_at: null, updated_at: null,
});
const oc = (c: ContaPagar, vencimento: string, transacao_id: string | null | undefined): OcorrenciaConta => ({
  conta: c, competencia: '2026-11', vencimento, situacao: transacao_id === undefined ? 'pendente' : 'paga',
  pagamento: transacao_id === undefined ? null : { id: 'p', conta_id: c.id, user_id: 'u', competencia: '2026-11', pago_em: '2026-10-31', transacao_id, created_at: null },
});

describe('contasFixasDoMes', () => {
  const ocorrencias = [
    oc(conta('ing', 'Inglês', 270), '2026-11-30', undefined),
    oc(conta('tab', 'Tablet', 100), '2026-11-01', 't1'),
    oc(conta('alu', 'Aluguel', 315, 'Educação'), '2026-11-05', null),
  ];
  it('todas as contas do mês, pagas e a pagar, por vencimento; paga usa o valor do Paguei', () => {
    const r = contasFixasDoMes(ocorrencias, [{ id: 't1', valor: 95 }]);
    expect(r.itens.map((c) => [c.descricao, c.valor, c.paga, c.pagoEm])).toEqual([
      ['Tablet', 95, true, '2026-10-31'], ['Aluguel', 315, true, '2026-10-31'], ['Inglês', 270, false, null],
    ]);
    expect([r.total, r.pagas, r.aPagar]).toEqual([680, 2, 1]);
  });
  it('filtro de categoria vale também para as contas', () => {
    expect(contasFixasDoMes(ocorrencias, [], 'Educação').itens.map((c) => c.id)).toEqual(['alu']);
  });
});
