import { describe, expect, it } from 'vitest';
import { dividirParcelas, PARCELAS_MAX, rotuloParcela, ritmoDiarioDoMes, normalizarBusca, ultimasDespesas } from '../../index';
import type { Transacao } from '../../types/financas';

describe('ritmoDiarioDoMes', () => {
  it.each([
    ['2026-11', 160, '2026-11-15', 16, 10, 'folga', 0],
    ['2026-11', 100, '2026-11-30', 1, 100, 'folga', 0],
    ['2026-11', 300, '2026-11-01', 30, 10, 'folga', 0],
    ['2025-02', 280, '2025-02-01', 28, 10, 'folga', 0],
    ['2024-02', 290, '2024-02-01', 29, 10, 'folga', 0],
    ['2024-02', 100, '2024-02-29', 1, 100, 'folga', 0],
    ['2026-11', -12.34, '2026-11-15', 16, 0, 'sem_folga', 12.34],
    ['2026-11', 0, '2026-11-15', 16, 0, 'sem_folga', 0],
    ['2026-11', 100, '2026-12-01', 0, 0, 'encerrado', 0],
    ['2026-11', -50, '2027-01-01', 0, 0, 'encerrado', 50],
    ['2026-12', 310, '2026-11-20', 31, 10, 'folga', 0],
    ['2026-11', 100, '2026-11-28', 3, 33.33, 'folga', 0],
    ['2026-11', 0.29, '2026-11-30', 1, 0.29, 'folga', 0],
    ['2026-11', 0.01, '2026-11-28', 3, 0, 'folga', 0],
  ])('%s sobra %s em %s', (mes, sobra, hoje, dias, valor, estado, excedente) => {
    expect(ritmoDiarioDoMes(mes, sobra, hoje)).toEqual({ diasRestantes: dias, disponivelPorDia: valor, estado, excedente });
  });
});

describe('dividirParcelas', () => {
  it('centavos: resto inteiro na primeira, descrição/data não se deslocam', () => {
    expect(dividirParcelas(100, 3, '2026-01-31')).toEqual([
      { parcela_num: 1, valor: 33.34, data: '2026-01-31' },
      { parcela_num: 2, valor: 33.33, data: '2026-02-28' },
      { parcela_num: 3, valor: 33.33, data: '2026-03-31' },
    ]);
  });
  it('clamp bissexto sem perder dia original', () => {
    expect(dividirParcelas(100, 3, '2024-01-31').map(p => p.data)).toEqual(['2024-01-31', '2024-02-29', '2024-03-31']);
    expect(dividirParcelas(24, 13, '2024-02-29').at(-1)?.data).toBe('2025-02-28');
  });
  it('dezembro → janeiro e fevereiro', () => {
    expect(dividirParcelas(100, 3, '2026-12-31').map(p => p.data)).toEqual(['2026-12-31', '2027-01-31', '2027-02-28']);
  });
  it('soma em centavos exata em todos os n e valores; nenhuma perda por ponto flutuante', () => {
    expect(PARCELAS_MAX).toBe(24);
    for (let n = 2; n <= PARCELAS_MAX; n++) {
      for (const cents of [n, 29, 100, 10001, 9999999999]) {
        const rows = dividirParcelas(cents / 100, n, '2026-01-31');
        expect(rows).toHaveLength(n);
        expect(rows.reduce((s, p) => s + Math.round(p.valor * 100), 0)).toBe(cents);
        expect(rows.slice(1).every(p => Math.round(p.valor * 100) === Math.floor(cents / n))).toBe(true);
      }
    }
  });
  it.each([0, 1, 25, -2, 2.5, NaN, Infinity])('n inválido %s', n => {
    expect(() => dividirParcelas(100, n, '2026-01-01')).toThrow(/parcelas/i);
  });
  it.each([0, -1, 1.001, NaN, Infinity, Number.MAX_VALUE])('total inválido %s', total => {
    expect(() => dividirParcelas(total, 2, '2026-01-01')).toThrow(/valor|total/i);
  });
  it.each(['2026-02-30', '2026-13-01', 'invalida', '2026-1-01'])('data inválida %s', data => {
    expect(() => dividirParcelas(100, 2, data)).toThrow(/data/i);
  });
  it('rótulo é só exibição', () => {
    expect(rotuloParcela({ parcela_num: 3, parcela_total: 10 })).toBe('3/10');
    expect(rotuloParcela({})).toBeNull();
    expect(rotuloParcela({ parcela_num: null, parcela_total: null })).toBeNull();
    expect(rotuloParcela({ parcela_num: 1 })).toBeNull();
  });
});

describe('busca Gastos', () => {
  const tx = (id: string, over: Partial<Transacao> = {}): Transacao => ({
    id, user_id: 'u', tipo: 'despesa', descricao: 'Açaí da Praça', categoria: 'Alimentação', valor: 10,
    data: '2026-11-10', banco: null, automatico: false, created_at: '', ...over,
  });
  const rows = [tx('a', { origem: 'whatsapp' }), tx('b', { descricao: 'Café', valor: 20 }),
    tx('c', { descricao: 'Açaí', categoria: 'Lazer', data: '2026-11-11' }),
    tx('r', { tipo: 'receita' }), tx('j', { ajuste: true }), tx('m', { data: '2026-10-10' })];
  const filtrar = (f: { busca?: string; soWhatsapp?: boolean; categoria?: string } = {}) => ultimasDespesas(rows, { mes: '2026-11', ...f });
  it('normalização NFD, caixa, espaços e trim', () => expect(normalizarBusca('  AÇAÍ\t da\n PRAÇA  ')).toBe('acai da praca'));
  it('acentos e termos em qualquer ordem; todos obrigatórios', () => {
    expect(filtrar({ busca: 'PRACA acai' }).quantidade).toBe(1);
    expect(filtrar({ busca: 'acai inexistente' }).quantidade).toBe(0);
  });
  it('categoria também participa da busca', () => {
    expect(filtrar({ busca: 'alimentacao' }).quantidade).toBe(2);
    expect(filtrar({ busca: 'acai alimentacao' }).dias[0]?.itens.map(t => t.id)).toEqual(['a']);
  });
  it('WhatsApp não confunde automatico nem origem ausente', () => {
    expect(filtrar({ soWhatsapp: true }).dias[0]?.itens.map(t => t.id)).toEqual(['a']);
    expect(filtrar({ soWhatsapp: false }).quantidade).toBe(3);
  });
  it('combina busca, WhatsApp e categoria e mantém totais/dias filtrados', () => {
    const res = filtrar({ busca: 'acai', soWhatsapp: true, categoria: 'Alimentação' });
    expect(res).toMatchObject({ quantidade: 1, total: 10, dias: [{ data: '2026-11-10', total: 10 }] });
    expect(res.categorias).toEqual(['Alimentação', 'Lazer']);
    expect(filtrar({ busca: 'acai', soWhatsapp: true, categoria: 'Lazer' }).dias).toEqual([]);
  });
  it.each(['', '  \n\t '])('busca vazia %j não filtra', busca => expect(filtrar({ busca })).toEqual(filtrar()));
});

it('revisão 1: nenhuma parcela de zero centavos', () => {
  for (const [total, n] of [[0.01, 2], [0.05, 24]])
    expect(() => dividirParcelas(total!, n!, '2026-11-01')).toThrow('O valor total precisa ser de pelo menos R$ 0,01 por parcela.');
});
it('revisão 7: estado usa centavos, mantendo folga pequena real', () => {
  expect(ritmoDiarioDoMes('2026-11', 100 - 70.1 - 29.9, '2026-11-01').estado).toBe('sem_folga');
  expect(ritmoDiarioDoMes('2026-11', 0.1, '2026-11-01')).toMatchObject({ estado: 'folga', disponivelPorDia: 0 });
});
it.each([[0,3], [-1,3], [4,3], [1.5,3], [1,0]])('revisão 10: rótulo inválido %s/%s', (num,total) => {
  expect(rotuloParcela({ parcela_num: num, parcela_total: total })).toBeNull();
});
it('revisão 9: busca vazia não lê descrição das linhas', () => {
  const linha = { created_at: '', tipo: 'despesa' as const, categoria: 'Outros', valor: 1, data: '2026-11-01', get descricao(): string { throw new Error('normalização desnecessária'); } };
  expect(ultimasDespesas([linha], { mes: '2026-11', busca: '  ' }).quantidade).toBe(1);
});
