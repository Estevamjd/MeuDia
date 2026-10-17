import { describe, expect, it } from 'vitest';
import type { Carteira, ContaPagar, Renda, Transacao, Transferencia } from '../../types/financas';
import {
  alvosPrevisao,
  comecouMesCom,
  entraNoSaldo,
  evolucaoMes,
  gastoDoMes,
  gastosPorCategoria,
  previsao,
  rendaDoMes,
  saldoCarteira,
  saldoHoje,
  saldosCarteiras,
  somarDias,
} from '../saldo';
import { categoriaInfo, CATEGORIAS } from '../../constants/categorias';

// Hoje = 17/10/2026 12:00 em SP (15:00Z); a carteira é cadastrada nesse instante.
const HOJE = '2026-10-17';
const ANCORA = '2026-10-17T15:00:00.000Z';
let seq = 0;
const depois = () => new Date(Date.parse(ANCORA) + 60_000 * ++seq).toISOString();

const carteira = (id: string, nome: string, saldo: number, over: Partial<Carteira> = {}): Carteira => ({
  id, user_id: 'u', nome, tipo: 'banco', saldo_inicial: saldo, saldo_inicial_em: ANCORA,
  incluir_no_total: true, arquivada: false, ordem: 0, created_at: ANCORA, updated_at: ANCORA, ...over,
});
const tx = (over: Partial<Transacao>): Transacao => ({
  id: `t${++seq}`, user_id: 'u', tipo: 'despesa', categoria: 'Outros', descricao: 'x', valor: 0, data: HOJE,
  banco: null, automatico: false, created_at: depois(), carteira_id: null, ajuste: false, ...over,
});
const transf = (origem_id: string, destino_id: string, valor: number, data = HOJE): Transferencia => ({
  id: `tr${++seq}`, user_id: 'u', origem_id, destino_id, valor, data, descricao: null, created_at: depois(),
});
const conta = (id: string, descricao: string, valor: number, dia: number, categoria = 'Contas'): ContaPagar => ({
  id, user_id: 'u', assinatura_id: null, descricao, categoria, valor, recorrencia: 'mensal', dia_vencimento: dia,
  mes_vencimento: null, data_vencimento: null, ativo: true, created_at: '2026-10-17T15:05:00Z', updated_at: null,
});
const renda = (valor: number, dia: number | null, over: Partial<Renda> = {}): Renda => ({
  id: 'r1', user_id: 'u', descricao: 'Salário', valor, dia_recebimento: dia, ativo: true,
  created_at: '2026-10-17T15:30:00Z', updated_at: null, ...over,
});

describe('BRIEF §5: exemplo de aceite passo a passo (17/10/2026)', () => {
  const nubank = carteira('nu', 'Nubank', 650);
  const caixa = carteira('cx', 'Caixa', 50, { ordem: 1 });
  const carteiras = [nubank, caixa];
  const contas = [conta('luz', 'Luz', 120, 20, 'Luz'), conta('net', 'Internet', 100, 25, 'Internet')];
  const { seteDias, fimDoMes } = alvosPrevisao(HOJE);
  const prever = (hoje: number, rendas: Renda[] = [], recebimentos: { renda_id: string; competencia: string }[] = []) => ({
    sete: previsao({ hojeISO: HOJE, alvoISO: seteDias, saldoHoje: hoje, rendas, recebimentos, contas, pagamentos: [] }).valor,
    fim: previsao({ hojeISO: HOJE, alvoISO: fimDoMes, saldoHoje: hoje, rendas, recebimentos, contas, pagamentos: [] }).valor,
  });

  it('alvos: 7 dias = 24/10 e fim do mês = 31/10', () => {
    expect(seteDias).toBe('2026-10-24');
    expect(fimDoMes).toBe('2026-10-31');
  });

  it('percorre os 6 passos com os valores do BRIEF', () => {
    const transacoes: Transacao[] = [];
    const transferencias: Transferencia[] = [];
    const hoje = () => saldoHoje(carteiras, transacoes, transferencias);
    const chips = () => saldosCarteiras(carteiras, transacoes, transferencias).map((s) => [s.carteira.nome, s.saldo]);

    // 1. Nubank 650 + Caixa 50.
    expect(hoje()).toBe(700);
    // 2. Entrou dinheiro R$ 100 na Caixa.
    transacoes.push(tx({ tipo: 'receita', categoria: 'Entrada extra', valor: 100, carteira_id: 'cx' }));
    expect(hoje()).toBe(800);
    expect(chips()).toEqual([['Nubank', 650], ['Caixa', 150]]);
    // 3. Luz 120 (20/10) e internet 100 (25/10) pendentes.
    expect(prever(hoje())).toEqual({ sete: 680, fim: 580 });
    // 4. Transferir 50 Caixa → Nubank: total igual, gasto do mês não muda.
    const gastoAntes = gastoDoMes(transacoes);
    transferencias.push(transf('cx', 'nu', 50));
    expect(hoje()).toBe(800);
    expect(chips()).toEqual([['Nubank', 700], ['Caixa', 100]]);
    expect(gastoDoMes(transacoes)).toBe(gastoAntes);
    // 5. Gastei 25 em Comida no Nubank.
    transacoes.push(tx({ tipo: 'despesa', categoria: 'Comida', valor: 25, carteira_id: 'nu' }));
    expect(hoje()).toBe(775);
    expect(gastosPorCategoria(transacoes)).toEqual([{ categoria: 'Comida', valor: 25 }]);
    expect(prever(hoje()).fim).toBe(555);
    // 6. Renda 900 dia 5 cadastrada agora; antes do Recebi entra como "a receber".
    const r = renda(900, 5);
    expect(hoje()).toBe(775);
    expect(prever(hoje(), [r])).toEqual({ sete: 1555, fim: 1455 });
    // Recebi: R$ 900 no Nubank, sem contar duas vezes.
    transacoes.push(tx({ tipo: 'receita', categoria: 'Salário', valor: 900, carteira_id: 'nu' }));
    const recebimentos = [{ renda_id: 'r1', competencia: '2026-10' }];
    expect(hoje()).toBe(1675);
    expect(prever(hoje(), [r], recebimentos)).toEqual({ sete: 1555, fim: 1455 });
    expect(rendaDoMes('2026-10', transacoes, [r], recebimentos)).toEqual({ lancada: 1000, aReceber: 0, total: 1000 });
  });

  it('"por quê?" lista cada item com sinal e data', () => {
    const p = previsao({ hojeISO: HOJE, alvoISO: fimDoMes, saldoHoje: 800, rendas: [], recebimentos: [], contas, pagamentos: [] });
    expect(p.itens.map((i) => [i.descricao, i.valor, i.data])).toEqual([['Luz', -120, '2026-10-20'], ['Internet', -100, '2026-10-25']]);
    expect(p.saldoHoje).toBe(800);
  });
});

describe('R11: regressão do bug da renda', () => {
  it('renda 900 sem recebimento + 100 extra = 1.000 (nunca 100)', () => {
    const extra = [tx({ tipo: 'receita', categoria: 'Entrada extra', valor: 100 })];
    expect(rendaDoMes('2026-10', extra, [renda(900, 5)], []).total).toBe(1000);
  });
  it('ajuste fica fora da renda e do gasto', () => {
    const rows = [
      tx({ tipo: 'receita', valor: 50, ajuste: true }), tx({ tipo: 'despesa', valor: 30, ajuste: true }),
      tx({ tipo: 'despesa', valor: 10 }),
    ];
    expect(rendaDoMes('2026-10', rows, [], []).total).toBe(0);
    expect(gastoDoMes(rows)).toBe(10);
    expect(gastosPorCategoria(rows)).toEqual([{ categoria: 'Outros', valor: 10 }]);
  });
  it('renda inativa ou criada depois da competência não entra', () => {
    expect(rendaDoMes('2026-10', [], [renda(900, 5, { ativo: false })], []).total).toBe(0);
    expect(rendaDoMes('2026-09', [], [renda(900, 5)], []).total).toBe(0);
    expect(rendaDoMes('2026-09', [], [renda(900, 5, { created_at: null })], []).total).toBe(900);
  });
});

describe('bordas do saldo', () => {
  const c = carteira('c', 'Banco', 100);

  it('âncora no mesmo dia: só conta o criado depois do instante do cadastro', () => {
    expect(entraNoSaldo(c, { data: HOJE, created_at: '2026-10-17T14:59:59Z' })).toBe(false);
    expect(entraNoSaldo(c, { data: HOJE, created_at: '2026-10-17T15:00:01Z' })).toBe(true);
    expect(entraNoSaldo(c, { data: HOJE, created_at: null })).toBe(false);
    expect(entraNoSaldo(c, { data: '2026-10-16', created_at: '2026-10-17T16:00:00Z' })).toBe(false);
    expect(entraNoSaldo(c, { data: '2026-10-18', created_at: '2026-10-17T10:00:00Z' })).toBe(true);
    // 23:30 de 16/10 em SP já é 17/10 em UTC: o dia da âncora é o de SP.
    const noite = carteira('n', 'Noite', 0, { saldo_inicial_em: '2026-10-17T02:30:00Z' });
    expect(entraNoSaldo(noite, { data: '2026-10-17', created_at: null })).toBe(true);
  });

  it('lançamento legado (sem carteira) não entra em nenhum saldo', () => {
    expect(saldoCarteira(c, [tx({ valor: 40, carteira_id: null })], [])).toBe(100);
  });

  it('carteira arquivada sai do total e dos chips; incluir_no_total=false só sai do total', () => {
    const arq = carteira('a', 'Antiga', 300, { arquivada: true });
    const poup = carteira('p', 'Poupança', 1000, { incluir_no_total: false, tipo: 'poupanca' });
    expect(saldoHoje([c, arq, poup], [], [])).toBe(100);
    expect(saldosCarteiras([c, arq, poup], [], []).map((s) => s.carteira.id)).toEqual(['c', 'p']);
  });

  it('ajuste entra no saldo; saldo pode ficar negativo; centavos sem erro de ponto flutuante', () => {
    const rows = [
      tx({ tipo: 'receita', valor: 0.1, carteira_id: 'c' }), tx({ tipo: 'receita', valor: 0.2, carteira_id: 'c' }),
      tx({ tipo: 'despesa', valor: 250.3, carteira_id: 'c', ajuste: true }),
    ];
    expect(saldoCarteira(c, rows, [])).toBe(-150);
  });

  it('alvo de 7 dias cruzando o mês inclui contas/rendas do mês seguinte até o alvo', () => {
    const hoje = '2026-10-28';
    const alvo = somarDias(hoje, 7);
    expect(alvo).toBe('2026-11-04');
    const contas = [conta('a', 'Aluguel', 500, 2), conta('b', 'Internet', 100, 10)];
    const r = renda(900, 3, { created_at: '2026-10-01T12:00:00Z' });
    const p = previsao({
      hojeISO: hoje, alvoISO: alvo, saldoHoje: 1000, rendas: [r],
      recebimentos: [{ renda_id: 'r1', competencia: '2026-10' }], contas, pagamentos: [{ conta_id: 'a', competencia: '2026-10' }],
    });
    // Outubro: aluguel pago, internet 10/10 vencida e não paga; renda recebida. Novembro: aluguel 02/11 e renda 03/11.
    expect(p.itens.map((i) => [i.descricao, i.competencia, i.vencida])).toEqual([
      ['Internet', '2026-10', true], ['Aluguel', '2026-11', false], ['Salário', '2026-11', false],
    ]);
    expect(p.valor).toBe(1000 - 100 - 500 + 900);
  });

  it('conta vencida não paga entra; paga não entra', () => {
    const contas = [conta('v', 'Água', 80, 5)];
    const base = { hojeISO: HOJE, alvoISO: '2026-10-24', saldoHoje: 500, rendas: [], recebimentos: [], contas };
    const p = previsao({ ...base, pagamentos: [] });
    expect(p.valor).toBe(420);
    expect(p.itens[0]?.vencida).toBe(true);
    expect(previsao({ ...base, pagamentos: [{ conta_id: 'v', competencia: '2026-10' }] }).valor).toBe(500);
  });

  it('renda sem dia conta no último dia do mês', () => {
    const base = { hojeISO: HOJE, saldoHoje: 0, rendas: [renda(900, null)], recebimentos: [], contas: [], pagamentos: [] };
    expect(previsao({ ...base, alvoISO: '2026-10-24' }).valor).toBe(0);
    expect(previsao({ ...base, alvoISO: '2026-10-31' }).valor).toBe(900);
  });
});

describe('R12: começou o mês com', () => {
  const antiga = carteira('c', 'Banco', 1000, { saldo_inicial_em: '2026-09-20T15:00:00Z' });
  const rows = [
    tx({ tipo: 'despesa', valor: 200, carteira_id: 'c', data: '2026-09-25', created_at: '2026-09-25T12:00:00Z' }),
    tx({ tipo: 'receita', valor: 50, carteira_id: 'c', data: '2026-10-02', created_at: '2026-10-02T12:00:00Z' }),
  ];

  it('saldo no fim de 30/09 pela fórmula da R2', () => {
    expect(comecouMesCom([antiga], rows, [], '2026-10')).toBe(800);
    expect(saldoCarteira(antiga, rows, [])).toBe(850);
  });
  it('carteira criada neste mês não tem "começou com"', () => {
    expect(comecouMesCom([carteira('n', 'Nova', 10)], [], [], '2026-10')).toBeNull();
  });
});

describe('evolução do mês e categorias', () => {
  it('gasto por dia + saldo no fim de cada dia (null antes da carteira existir)', () => {
    const c = carteira('c', 'Banco', 100, { saldo_inicial_em: '2026-10-02T15:00:00Z' });
    const mes = [
      tx({ tipo: 'despesa', valor: 30, carteira_id: 'c', data: '2026-10-03', created_at: '2026-10-03T12:00:00Z' }),
      tx({ tipo: 'despesa', valor: 5, carteira_id: null, data: '2026-10-01', created_at: '2026-10-01T12:00:00Z' }),
    ];
    const pontos = evolucaoMes('2026-10', '2026-10-04', mes, [c], mes, []);
    expect(pontos).toEqual([
      { dia: 1, data: '2026-10-01', gasto: 5, saldo: null },
      { dia: 2, data: '2026-10-02', gasto: 0, saldo: 100 },
      { dia: 3, data: '2026-10-03', gasto: 30, saldo: 70 },
      { dia: 4, data: '2026-10-04', gasto: 0, saldo: 70 },
    ]);
  });

  it('top 5 + Outros', () => {
    const rows = ['A', 'B', 'C', 'D', 'E', 'F', 'G'].map((categoria, i) => tx({ categoria, valor: 70 - i * 10 }));
    expect(gastosPorCategoria(rows).map((f) => [f.categoria, f.valor])).toEqual([
      ['A', 70], ['B', 60], ['C', 50], ['D', 40], ['E', 30], ['Outros', 30],
    ]);
  });

  it('mapa de ícones: categorias mínimas do BRIEF, aliases e fallback para Outros', () => {
    const nomes = CATEGORIAS.map((c) => c.nome);
    for (const n of ['Mercado', 'Comida', 'Restaurante', 'Transporte', 'Combustível', 'Aluguel', 'Luz', 'Água', 'Internet',
      'Celular', 'Streaming', 'Academia', 'Saúde', 'Curso', 'Faculdade', 'Unha', 'Estética', 'Cabelo', 'Roupa', 'Pet',
      'Presente', 'Lazer', 'Viagem', 'Casa', 'Educação', 'Assinaturas', 'Contas', 'Salário', 'Entrada extra',
      'Ajuste de saldo', 'Outros']) expect(nomes).toContain(n);
    expect(categoriaInfo('lanche').nome).toBe('Comida');
    expect(categoriaInfo('FARMACIA').nome).toBe('Saúde');
    expect(categoriaInfo('Sobrancelha').nome).toBe('Estética');
    expect(categoriaInfo('Categoria inventada').nome).toBe('Outros');
    expect(categoriaInfo(null).icone).toBe('tag');
    expect(new Set(nomes).size).toBe(nomes.length);
  });
});
