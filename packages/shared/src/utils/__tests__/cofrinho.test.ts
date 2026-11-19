import { describe, expect, it } from 'vitest';
import type { ContaPagar, Renda, Transacao } from '../../types/financas';
import { sobraDoMes } from '../saldo';
import { competenciaAnterior, perguntaFechamento, saldoCofrinho } from '../cofrinho';

let seq = 0;
const tx = (over: Partial<Transacao>): Transacao => ({
  id: `t${++seq}`, user_id: 'u', tipo: 'despesa', categoria: 'Outros', descricao: 'x', valor: 0, data: '2026-11-10',
  banco: null, automatico: false, created_at: '2026-11-10T12:00:00Z', carteira_id: null, ajuste: false, ...over,
});
const conta = (id: string, descricao: string, valor: number, dia: number): ContaPagar => ({
  id, user_id: 'u', assinatura_id: null, descricao, categoria: 'Contas', valor, recorrencia: 'mensal', dia_vencimento: dia,
  mes_vencimento: null, data_vencimento: null, ativo: true, created_at: '2026-10-01T12:00:00Z', updated_at: null,
});
const salario: Renda = {
  id: 'r1', user_id: 'u', descricao: 'Renda principal', valor: 2000, dia_recebimento: 1, ativo: true,
  created_at: '2026-10-01T12:00:00Z', updated_at: null,
};
const contas = [conta('alu', 'Aluguel', 700, 5), conta('cur', 'Curso', 300, 30), conta('cel', 'Celular', 80, 1), conta('car', 'Cartão', 120, 10), conta('aca', 'Academia', 100, 5)];
const pag = (conta_id: string, competencia: string, transacao_id: string, pago_em: string) => ({ conta_id, competencia, transacao_id, pago_em });

describe('sobraDoMes (modelo "conta explícita")', () => {
  // Celular de novembro pago em 31/10; Aluguel, Cartão e Academia pagos em novembro; Curso a pagar.
  const tTablet = tx({ valor: 80, data: '2026-10-31' });
  const tFac = tx({ valor: 700, data: '2026-11-05' });
  const tBra = tx({ valor: 120, data: '2026-11-05' });
  const tUnh = tx({ valor: 100, data: '2026-11-09' });
  const pagamentos = [pag('cel', '2026-11', tTablet.id, '2026-10-31'), pag('alu', '2026-11', tFac.id, '2026-11-05'),
    pag('car', '2026-11', tBra.id, '2026-11-05'), pag('aca', '2026-11', tUnh.id, '2026-11-09')];
  const base = { competencia: '2026-11', rendas: [salario], contas, pagamentos };

  it('antes do "Recebi": renda prevista, todas as contas (pagas ou não), nenhum pagamento vira gasto extra', () => {
    const s = sobraDoMes({ ...base, transacoes: [tTablet, tFac, tBra, tUnh], recebimentos: [] });
    expect(s.previsao).toBe(true);
    expect(s.renda.total).toBe(2000);
    expect(s.totalContasFixas).toBe(1300);
    expect(s.totalContasPagas).toBe(1000);
    expect(s.gastosExtras).toBe(0);
    expect(s.valor).toBe(700);
    expect(s.contasFixas.map((c) => [c.descricao, c.paga, c.pagoEm])).toEqual([
      ['Celular', true, '2026-10-31'], ['Academia', true, '2026-11-09'], ['Aluguel', true, '2026-11-05'],
      ['Cartão', true, '2026-11-05'], ['Curso', false, null],
    ]);
    expect(s.contasAPagar.map((c) => c.descricao)).toEqual(['Curso']);
  });

  it('depois do "Recebi": renda recebida; gasto extra desconta; "Paguei" não conta duas vezes', () => {
    const recebido = tx({ tipo: 'receita', categoria: 'Salário', valor: 2000, data: '2026-11-01' });
    const mercado = tx({ valor: 40.5, data: '2026-11-12', categoria: 'Mercado' });
    const ajuste = tx({ valor: 12, data: '2026-11-12', ajuste: true });
    const s = sobraDoMes({ ...base, transacoes: [tTablet, tFac, tBra, tUnh, recebido, mercado, ajuste], recebimentos: [{ renda_id: 'r1', competencia: '2026-11' }] });
    expect(s.previsao).toBe(false);
    expect(s.renda.lancada).toBe(2000);
    expect(s.gastosExtras).toBe(40.5);
    expect(s.valor).toBe(659.5);
    // Pagar o Curso: a conta sai de "a pagar" e o valor da sobra não muda.
    const tIng = tx({ valor: 300, data: '2026-11-20' });
    const pago = sobraDoMes({ ...base, pagamentos: [...pagamentos, pag('cur', '2026-11', tIng.id, '2026-11-20')],
      transacoes: [tTablet, tFac, tBra, tUnh, recebido, mercado, ajuste, tIng], recebimentos: [{ renda_id: 'r1', competencia: '2026-11' }] });
    expect(pago.valor).toBe(659.5);
    expect(pago.contasAPagar).toEqual([]);
  });

  it('conta paga com valor diferente usa o valor pago; lançamento de conta de outro mês não vira extra', () => {
    const tFacOut = tx({ valor: 300, data: '2026-11-02' });
    const s = sobraDoMes({
      competencia: '2026-11', rendas: [salario], contas: [conta('alu', 'Aluguel', 315, 5)], recebimentos: [],
      pagamentos: [pag('alu', '2026-11', tFacOut.id, '2026-11-02')],
      // Pagamento de outubro feito em novembro (vinculado, sem estar em `pagamentos` deste mês).
      transacoes: [tFacOut, tx({ id: 'velha', valor: 315, data: '2026-11-01' })], transacoesDeContas: { velha: 315 },
    });
    expect(s.totalContasFixas).toBe(300);
    expect(s.gastosExtras).toBe(0);
    expect(s.valor).toBe(1700);
  });

  it('sem ids nos lançamentos: todo gasto é extra (compatível com chamadas antigas)', () => {
    const s = sobraDoMes({ competencia: '2026-11', rendas: [], contas: [], recebimentos: [], pagamentos: [],
      transacoes: [{ tipo: 'despesa', valor: 10, data: '2026-11-03', ajuste: false }] });
    expect(s.gastosExtras).toBe(10);
    expect(s.valor).toBe(-10);
  });
});

describe('saldoCofrinho', () => {
  it('soma os movimentos com sinal, em centavos', () => {
    expect(saldoCofrinho([{ valor: 150.03 }, { valor: 100 }, { valor: -0.1 }, { valor: -0.2 }])).toBe(249.73);
    expect(saldoCofrinho([])).toBe(0);
  });
});

describe('perguntaFechamento', () => {
  const sobras: Record<string, number> = { '2026-10': 199, '2026-11': 99, '2026-12': 50 };
  const sobraDe = (c: string) => sobras[c] ?? null;
  const inicio = '2026-11-19T15:00:00Z';

  it('primeiro acesso do mês seguinte pergunta do mês anterior', () => {
    expect(perguntaFechamento({ hojeISO: '2026-12-01', inicioCofrinho: inicio, respondidas: [], sobraDe })).toEqual({ competencia: '2026-11', valor: 99 });
  });
  it('no último dia do mês já pergunta do mês atual; antes disso não', () => {
    expect(perguntaFechamento({ hojeISO: '2026-11-30', inicioCofrinho: inicio, respondidas: [], sobraDe })).toEqual({ competencia: '2026-11', valor: 99 });
    expect(perguntaFechamento({ hojeISO: '2026-11-29', inicioCofrinho: inicio, respondidas: [], sobraDe })).toBeNull();
  });
  it('nunca pergunta de meses antes do Cofrinho começar (outubro)', () => {
    expect(perguntaFechamento({ hojeISO: '2026-11-19', inicioCofrinho: inicio, respondidas: [], sobraDe })).toBeNull();
  });
  it('uma vez por mês: respondido (Guardar ou Agora não) não pergunta de novo', () => {
    expect(perguntaFechamento({ hojeISO: '2026-12-01', inicioCofrinho: inicio, respondidas: ['2026-11'], sobraDe })).toBeNull();
    expect(perguntaFechamento({ hojeISO: '2026-11-30', inicioCofrinho: inicio, respondidas: ['2026-11'], sobraDe })).toBeNull();
  });
  it('sem sobra (zero ou negativa) ou sem dados não pergunta', () => {
    expect(perguntaFechamento({ hojeISO: '2026-12-01', inicioCofrinho: inicio, respondidas: [], sobraDe: () => 0 })).toBeNull();
    expect(perguntaFechamento({ hojeISO: '2026-12-01', inicioCofrinho: inicio, respondidas: [], sobraDe: () => -20 })).toBeNull();
    expect(perguntaFechamento({ hojeISO: '2026-12-01', inicioCofrinho: inicio, respondidas: [], sobraDe: () => null })).toBeNull();
  });
  it('sem Cofrinho começado: só o mês atual, no último dia', () => {
    expect(perguntaFechamento({ hojeISO: '2026-12-31', inicioCofrinho: null, respondidas: [], sobraDe })).toEqual({ competencia: '2026-12', valor: 50 });
    expect(perguntaFechamento({ hojeISO: '2027-01-01', inicioCofrinho: null, respondidas: [], sobraDe })).toBeNull();
  });
  it('início às 23h em SP do dia 31/10 conta como outubro (fuso de SP)', () => {
    expect(perguntaFechamento({ hojeISO: '2026-11-01', inicioCofrinho: '2026-11-01T02:00:00Z', respondidas: [], sobraDe })).toEqual({ competencia: '2026-10', valor: 199 });
  });
  it('competenciaAnterior vira o ano', () => {
    expect(competenciaAnterior('2027-01')).toBe('2026-12');
  });
});
