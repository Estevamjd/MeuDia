import { describe, expect, it } from 'vitest';
import type { PontoEvolucao, SobraDoMes } from '@meudia/shared';
import { fatiasComCor, gastoAcumulado, numerosPainel, sobraPorMes, ultimosMeses } from '../montarPainel';

const sobra = (p: Partial<SobraDoMes>): SobraDoMes => ({
  competencia: '2026-11', renda: { total: 943 } as SobraDoMes['renda'], rendasAReceber: [], previsao: false,
  contasFixas: [
    { id: 'a', descricao: 'Curso', valor: 300, paga: true } as SobraDoMes['contasFixas'][number],
    { id: 'b', descricao: 'Celular', valor: 80, paga: false } as SobraDoMes['contasFixas'][number],
  ],
  totalContasFixas: 744, totalContasPagas: 620, gastosExtras: 59.9, despesasLancadas: 679.9, contasAPagar: [], despesas: 803.9, valor: 139.1, ...p,
});

describe('numerosPainel (bloco principal e "Para onde vai o salário")', () => {
  it('cenário da Lia: recebeu 943, já gastou 679,90, falta pagar 124, sobra 139,10; partes 79/6/15', () => {
    const n = numerosPainel(sobra({}));
    expect(n).toMatchObject({ recebeu: 943, jaGastou: 679.9, faltaPagar: 124, contasAPagar: 1, sobra: 139.1 });
    expect(n.partes).toEqual({ fixas: 79, extras: 6, sobra: 15 });
  });
  it('sem renda: sem partes (nada de divisão por zero)', () => {
    expect(numerosPainel(sobra({ renda: { total: 0 } as SobraDoMes['renda'] })).partes).toBeNull();
  });
  it('gastou mais que a renda: as partes não passam de 100 e a sobra fica 0 na barra', () => {
    const n = numerosPainel(sobra({ renda: { total: 500 } as SobraDoMes['renda'], valor: -303.9 }));
    expect(n.partes!.fixas + n.partes!.extras + n.partes!.sobra).toBeLessThanOrEqual(100);
    expect(n.partes!.sobra).toBe(0);
  });
});

describe('fatiasComCor', () => {
  it('cores fixas por posição e cinza no Outros', () => {
    const r = fatiasComCor([{ categoria: 'Educação', valor: 300 }, { categoria: 'Outros', valor: 5 }, { categoria: 'Cartão', valor: 220 }]);
    expect(r.map((f) => f.cor)).toEqual(['#3987e5', '#6b6b80', '#d95926']);
  });
});

describe('gastoAcumulado ("Seu mês dia a dia")', () => {
  const pontos: PontoEvolucao[] = [
    { dia: 1, data: '2026-11-01', gasto: 0, saldo: null },
    { dia: 2, data: '2026-11-02', gasto: 300, saldo: null },
    { dia: 3, data: '2026-11-03', gasto: 20.5, saldo: null },
  ];
  it('soma dia a dia até hoje e deixa o resto do mês vazio', () => {
    const r = gastoAcumulado(pontos, '2026-11', 0);
    expect(r).toHaveLength(30);
    expect(r.slice(0, 4).map((p) => p.gasto)).toEqual([0, 300, 320.5, null]);
    expect(r.every((p) => p.previsto === null)).toBe(true);
  });
  it('com contas a pagar: pontilhado de hoje (320,50) até o dia 30 (444,50)', () => {
    const r = gastoAcumulado(pontos, '2026-11', 124);
    expect(r[2]!.previsto).toBe(320.5);
    expect(r[29]!.previsto).toBe(444.5);
    expect(r[1]!.previsto).toBeNull();
  });
});

describe('sobraPorMes ("Quanto sobrou por mês")', () => {
  it('últimos 6 meses atravessando o ano', () => {
    expect(ultimosMeses('2026-02')).toEqual(['2025-09', '2025-10', '2025-11', '2025-12', '2026-01', '2026-02']);
  });
  it('fechados = entrou − saiu sem ajustes; mês corrente = previsão; mês vazio fica fora', () => {
    const r = sobraPorMes(
      [
        { competencia: '2026-09', transacoes: [] },
        { competencia: '2026-10', transacoes: [{ tipo: 'receita', valor: '943.00' }, { tipo: 'despesa', valor: 833 }, { tipo: 'despesa', valor: 50, ajuste: true }] },
        { competencia: '2026-11', transacoes: undefined },
      ],
      { competencia: '2026-11', valor: 139.1 },
    );
    expect(r).toEqual([
      { competencia: '2026-10', rotulo: 'out', valor: 110, previsao: false },
      { competencia: '2026-11', rotulo: 'nov', valor: 139.1, previsao: true },
    ]);
  });
});
