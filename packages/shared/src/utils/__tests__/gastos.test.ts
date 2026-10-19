import { describe, expect, it } from 'vitest';
import type { Transacao } from '../../types/financas';
import { entradasDoMes, pagasEmDia, ultimasDespesas } from '../gastos';

let seq = 0;
const tx = (over: Partial<Transacao>): Transacao => ({
  id: `t${++seq}`, user_id: 'u', tipo: 'despesa', categoria: 'Outros', descricao: 'x', valor: 0, data: '2026-10-17',
  banco: null, automatico: false, created_at: '2026-10-17T12:00:00Z', carteira_id: null, ajuste: false, ...over,
});

describe('entradasDoMes (DIAG §5.1: salário separado de extras)', () => {
  const salario = { id: 'r1', valor: 943, ativo: true };
  const pix = tx({ id: 'pix', tipo: 'receita', valor: 150, categoria: 'Entrada extra' });

  it('salário 943 sem Recebi + Pix 150 → recebido 0 de 943, extras 150', () => {
    expect(entradasDoMes([pix], [salario], [])).toEqual({ salarioRecebido: 0, salarioPrevisto: 943, extras: 150, total: 150 });
  });

  it('Recebi 943 + Pix 150 → 943 de 943, extras 150', () => {
    const recebido = tx({ id: 'sal', tipo: 'receita', valor: 943, categoria: 'Salário' });
    const r = entradasDoMes([recebido, pix], [salario], [{ transacao_id: 'sal' }]);
    expect(r).toEqual({ salarioRecebido: 943, salarioPrevisto: 943, extras: 150, total: 1093 });
  });

  it('ajuste, despesa e renda inativa ficam fora', () => {
    const r = entradasDoMes(
      [pix, tx({ tipo: 'receita', valor: 80, ajuste: true }), tx({ valor: 30 })],
      [salario, { id: 'r2', valor: 500, ativo: false }],
      [{ transacao_id: null }],
    );
    expect(r).toEqual({ salarioRecebido: 0, salarioPrevisto: 943, extras: 150, total: 150 });
  });
});

describe('pagasEmDia (DIAG §5.5: só contas elegíveis)', () => {
  const oc = (vencimento: string, pago_em: string | null, created_at = '2026-10-01T15:00:00Z') => ({
    vencimento,
    conta: { created_at },
    pagamento: pago_em ? { pago_em } : null,
  });

  it('ignora conta que venceu antes de a conta existir no app; sem elegíveis → null', () => {
    // Cadastrada em 10/10, venceu em 05/10 sem pagamento: não pune a usuária nova.
    expect(pagasEmDia([oc('2026-10-05', null, '2026-10-10T15:00:00Z')], '2026-10-18', [])).toBeNull();
  });

  it('ignora vencimento antes da âncora mais antiga das carteiras', () => {
    const ancoras = ['2026-10-12T15:00:00Z', '2026-10-09T15:00:00Z'];
    const contas = [oc('2026-10-08', null), oc('2026-10-10', '2026-10-10'), oc('2026-10-15', '2026-10-16')];
    // Elegíveis: 10/10 (em dia) e 15/10 (atrasada) → 50%.
    expect(pagasEmDia(contas, '2026-10-18', ancoras)).toBe(0.5);
  });

  it('só conta o que já venceu; sem data de cadastro vale tudo', () => {
    expect(pagasEmDia([oc('2026-10-20', null), oc('2026-10-02', '2026-10-01', null as never)], '2026-10-18', [])).toBe(1);
  });
});

describe('ultimasDespesas (Gastos › Últimas despesas)', () => {
  const lista = [
    tx({ id: 'a', descricao: 'Almoço', categoria: 'Comida', valor: 32.9, data: '2026-10-18', created_at: '2026-10-18T13:00:00Z' }),
    tx({ id: 'b', descricao: 'Mercado', categoria: 'Mercado', valor: 86.4, data: '2026-10-18', created_at: '2026-10-18T20:00:00Z' }),
    tx({ id: 'c', descricao: 'Unha', categoria: 'Estética', valor: 45, data: '2026-10-17' }),
    tx({ id: 'd', descricao: 'Feira', categoria: 'Mercado', valor: 50.1, data: '2026-10-02' }),
    tx({ id: 'e', descricao: 'Pix', tipo: 'receita', valor: 150, data: '2026-10-18' }),
    tx({ id: 'f', descricao: 'Ajuste', valor: 75, ajuste: true, data: '2026-10-18' }),
    tx({ id: 'g', descricao: 'Setembro', categoria: 'Mercado', valor: 10, data: '2026-09-30' }),
  ];

  it('só despesas do mês (sem ajuste), data desc e depois criação desc, agrupadas por dia, com total', () => {
    const r = ultimasDespesas(lista, { mes: '2026-10' });
    expect(r.dias.map((d) => [d.data, d.itens.map((t) => t.id)])).toEqual([
      ['2026-10-18', ['b', 'a']],
      ['2026-10-17', ['c']],
      ['2026-10-02', ['d']],
    ]);
    expect(r.dias[0]!.total).toBe(119.3);
    expect(r.total).toBe(214.4);
    expect(r.quantidade).toBe(4);
  });

  it('filtro de categoria', () => {
    const r = ultimasDespesas(lista, { mes: '2026-10', categoria: 'Mercado' });
    expect(r.dias.flatMap((d) => d.itens.map((t) => t.id))).toEqual(['b', 'd']);
    expect(r.total).toBe(136.5);
  });

  it('categorias do mês para o filtro (ordem alfabética, sem repetir)', () => {
    expect(ultimasDespesas(lista, { mes: '2026-10' }).categorias).toEqual(['Comida', 'Estética', 'Mercado']);
  });
});
