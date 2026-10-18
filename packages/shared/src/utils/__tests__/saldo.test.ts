import { describe, expect, it } from 'vitest';
import type { Carteira, ContaPagar, Renda, Transacao, Transferencia } from '../../types/financas';
import {
  comecouMesCom,
  emSeteDias,
  entraNoSaldo,
  evolucaoMes,
  gastoDoMes,
  gastosPorCategoria,
  rendaDoMes,
  saldoCarteira,
  saldoHoje,
  saldosCarteiras,
  sobraDoMes,
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
  // "No fim do mês sobra" (renda do mês − despesas do mês) e "Em 7 dias" (guardado + sobra).
  const prever = (hoje: number, transacoes: Transacao[], rendas: Renda[] = [], recebimentos: { renda_id: string; competencia: string }[] = []) => {
    const sobra = sobraDoMes({ competencia: '2026-10', transacoes, rendas, recebimentos, contas, pagamentos: [] });
    return { sete: emSeteDias(HOJE, hoje, sobra).valor, fim: sobra.valor };
  };

  it('alvo de "Em 7 dias" = 24/10', () => {
    expect(emSeteDias(HOJE, 0, { valor: 0 }).alvoISO).toBe('2026-10-24');
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
    // 3. Luz 120 (20/10) e internet 100 (25/10) pendentes: renda 100 (entrada extra) − 220 = −120; 800 − 120.
    expect(prever(hoje(), transacoes)).toEqual({ sete: 680, fim: -120 });
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
    expect(prever(hoje(), transacoes)).toEqual({ sete: 630, fim: -145 });
    // 6. Renda 900 dia 5 cadastrada agora; antes do Recebi entra na renda do mês: 1.000 − 245 = 755.
    const r = renda(900, 5);
    expect(hoje()).toBe(775);
    expect(prever(hoje(), transacoes, [r])).toEqual({ sete: 1530, fim: 755 });
    // Recebi: R$ 900 no Nubank, sem contar duas vezes.
    transacoes.push(tx({ tipo: 'receita', categoria: 'Salário', valor: 900, carteira_id: 'nu' }));
    const recebimentos = [{ renda_id: 'r1', competencia: '2026-10' }];
    expect(hoje()).toBe(1675);
    // A sobra não muda (a renda a receber virou receita lançada); o guardado sobe 900 e o "Em 7 dias" junto.
    expect(prever(hoje(), transacoes, [r], recebimentos)).toEqual({ sete: 2430, fim: 755 });
    expect(rendaDoMes('2026-10', transacoes, [r], recebimentos)).toEqual({ lancada: 1000, aReceber: 0, total: 1000 });
  });

  it('"por quê?": rendas a receber, despesas lançadas e cada conta a pagar com vencimento', () => {
    const p = sobraDoMes({ competencia: '2026-10', transacoes: [], rendas: [renda(900, 5)], recebimentos: [], contas, pagamentos: [] });
    expect(p.rendasAReceber).toEqual([{ id: 'r1', descricao: 'Salário', valor: 900, data: '2026-10-05' }]);
    expect(p.contasAPagar.map((c) => [c.descricao, c.valor, c.vencimento])).toEqual([['Luz', 120, '2026-10-20'], ['Internet', 100, '2026-10-25']]);
    expect([p.renda.total, p.despesasLancadas, p.despesas, p.valor]).toEqual([900, 0, 220, 680]);
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


describe('decisão final: "No fim do mês sobra" = renda do mês − despesas do mês; "Em 7 dias" = guardado + sobra', () => {
  // Hoje 17/10, saldo informado 235 em 17/10, Salário 2.200 dia 1 sem Recebi, conta mensal 110 dia 5 criada em 16/10.
  const salario = renda(2200, 1, { created_at: '2026-10-16T15:00:00Z' });
  const internet = { ...conta('net', 'Internet', 110, 5), created_at: '2026-10-16T15:00:00Z' };
  const nubank = carteira('nu', 'Nubank', 235);
  const sobra = (transacoes: Transacao[] = [], pagamentos: { conta_id: string; competencia: string }[] = []) =>
    sobraDoMes({ competencia: '2026-10', transacoes, rendas: [salario], recebimentos: [], contas: [internet], pagamentos });

  it('aceite: sobra 2.200 − 110 = 2.090; 7 dias = 235 + 2.090 = 2.325 (o card antigo dava 2.435)', () => {
    const s = sobra();
    expect([s.renda.total, s.despesas, s.valor]).toEqual([2200, 110, 2090]);
    expect(s.rendasAReceber).toEqual([{ id: 'r1', descricao: 'Salário', valor: 2200, data: '2026-10-01' }]);
    expect(s.contasAPagar).toEqual([{ id: 'net', descricao: 'Internet', categoria: 'Contas', valor: 110, vencimento: '2026-10-05' }]);
    expect(emSeteDias(HOJE, saldoHoje([nubank], [], []), s)).toEqual({ alvoISO: '2026-10-24', guardado: 235, sobra: 2090, valor: 2325 });
  });

  it('Gastei 50: sobra 2.040 e 7 dias = 185 + 2.040 = 2.225 (o gasto reduz o guardado e a sobra)', () => {
    const transacoes = [tx({ valor: 50, categoria: 'Comida', carteira_id: 'nu' })];
    const s = sobra(transacoes);
    expect(s.valor).toBe(2040);
    expect(emSeteDias(HOJE, saldoHoje([nubank], transacoes, []), s).valor).toBe(2225);
  });

  it('Paguei 110 não muda a sobra: a despesa lançada substitui a conta a pagar', () => {
    const antes = sobra().valor;
    const depois = sobra([tx({ valor: 110, categoria: 'Contas', carteira_id: 'nu' })], [{ conta_id: 'net', competencia: '2026-10' }]);
    expect(depois.contasAPagar).toEqual([]);
    expect(depois.despesasLancadas).toBe(110);
    expect(depois.valor).toBe(antes);
  });

  it('Recebi não conta a renda duas vezes: sai de "a receber" e entra como receita lançada', () => {
    const s = sobraDoMes({
      competencia: '2026-10', transacoes: [tx({ tipo: 'receita', categoria: 'Salário', valor: 2200, carteira_id: 'nu' })],
      rendas: [salario], recebimentos: [{ renda_id: 'r1', competencia: '2026-10' }], contas: [internet], pagamentos: [],
    });
    expect(s.renda).toEqual({ lancada: 2200, aReceber: 0, total: 2200 });
    expect(s.rendasAReceber).toEqual([]);
    expect(s.valor).toBe(2090);
  });

  it('só a competência conta: lançamentos, pagamentos e recebimentos de outro mês ficam fora; ajustes também', () => {
    const s = sobraDoMes({
      competencia: '2026-10',
      transacoes: [
        tx({ valor: 70, data: '2026-09-30' }), tx({ tipo: 'receita', valor: 500, data: '2026-11-01' }),
        tx({ valor: 30, ajuste: true }), tx({ tipo: 'receita', valor: 40, ajuste: true }),
      ],
      rendas: [salario], recebimentos: [{ renda_id: 'r1', competencia: '2026-09' }],
      contas: [internet], pagamentos: [{ conta_id: 'net', competencia: '2026-09' }],
    });
    expect([s.renda.total, s.despesasLancadas, s.despesas, s.valor]).toEqual([2200, 0, 110, 2090]);
  });

  it('contas: únicas e anuais só no mês delas, inativas e de antes da criação não; renda inativa/futura não', () => {
    const unica: ContaPagar = { ...conta('ipva', 'IPVA', 300, 1), recorrencia: 'unica', dia_vencimento: null, data_vencimento: '2026-10-28' };
    const anualOutroMes: ContaPagar = { ...conta('iptu', 'IPTU', 900, 10), recorrencia: 'anual', mes_vencimento: 3 };
    const inativa = { ...conta('x', 'Antiga', 50, 8), ativo: false };
    const futura = { ...conta('y', 'Academia', 90, 8), created_at: '2026-11-02T12:00:00Z' };
    const s = sobraDoMes({
      competencia: '2026-10', transacoes: [],
      rendas: [salario, renda(500, 20, { id: 'r2', created_at: '2026-11-02T12:00:00Z' }), renda(700, 20, { id: 'r3', ativo: false })],
      recebimentos: [], contas: [internet, unica, anualOutroMes, inativa, futura], pagamentos: [],
    });
    expect(s.renda.total).toBe(2200);
    expect(s.contasAPagar.map((c) => c.id)).toEqual(['net', 'ipva']);
    expect(s.valor).toBe(2200 - 110 - 300);
  });

  it('pode ficar negativo; centavos sem erro de ponto flutuante', () => {
    const s = sobraDoMes({ competencia: '2026-10', transacoes: [tx({ valor: 0.1 }), tx({ valor: 0.2 })], rendas: [], recebimentos: [], contas: [{ ...internet, valor: 2500.5 }], pagamentos: [] });
    expect(s.valor).toBe(-2500.8);
    expect(emSeteDias(HOJE, 235, s).valor).toBe(-2265.8);
  });
});
