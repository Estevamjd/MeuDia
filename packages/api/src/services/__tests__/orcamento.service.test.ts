import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as service from '../orcamento.service';
import { rendasRepository as rendas, orcamentoRepository as orcamento, transacaoRepository as transacoes, recebimentosRendaRepository as recebimentos, carteirasRepository as carteiras } from '../../repositories';
import { listarContasDoMes } from '../contas-pagar.service';
import { transacoesDoMes } from '../financas.service';
vi.mock('../../repositories', () => ({
  transacaoRepository: { findByIds: vi.fn() },
  rendasRepository: { findAll: vi.fn(), create: vi.fn(), update: vi.fn(), remove: vi.fn() },
  orcamentoRepository: { findAll: vi.fn(), create: vi.fn(), upsert: vi.fn(), update: vi.fn(), remove: vi.fn() },
  recebimentosRendaRepository: { findByCompetencias: vi.fn(), findByTransacoes: vi.fn() },
  carteirasRepository: { findAll: vi.fn() },
}));
vi.mock('../contas-pagar.service', () => ({ listarContasDoMes: vi.fn() }));
vi.mock('../financas.service', () => ({ transacoesDoMes: vi.fn() }));
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(rendas.findAll).mockResolvedValue([{ valor: 1000, ativo: true }] as never);
  vi.mocked(recebimentos.findByCompetencias).mockResolvedValue([]);
  vi.mocked(recebimentos.findByTransacoes).mockResolvedValue([]);
  vi.mocked(carteiras.findAll).mockResolvedValue([]);
  vi.mocked(orcamento.findAll).mockResolvedValue([{ categoria: 'Casa', valor_planejado: 300 }, { categoria: 'Lazer', valor_planejado: 100 }] as never);
  vi.mocked(listarContasDoMes).mockResolvedValue([
    { conta: { categoria: 'Casa', valor: 200 }, vencimento: '2026-01-05', situacao: 'paga', pagamento: { pago_em: '2026-01-05' } },
    { conta: { categoria: 'Casa', valor: 200 }, vencimento: '2026-01-10', situacao: 'vencida', pagamento: null },
    { conta: { categoria: 'Outros', valor: 50 }, vencimento: '2026-01-25', situacao: 'paga', pagamento: { pago_em: '2026-01-12' } },
  ] as never);
  vi.mocked(transacoesDoMes).mockImplementation(async (_, ano, mes) => (ano === 2025 && mes === 12 ? [{ data: '2025-12-10', tipo: 'despesa', valor: 100 }] : [{ data: '2026-01-10', tipo: 'receita', valor: 800 }, { data: '2026-01-10', tipo: 'despesa', valor: 300 }]) as never);
});
it('fixture de janeiro: max por categoria, prazo, deltas e dezembro anterior', async () => {
  // R11: a receita de 800 soma por cima da renda fixa de 1000 sem "Recebi" (1800 − 300).
  expect(await service.resumoFinanceiroMes('u', 2026, 1, '2026-01-15')).toEqual({
    rendaPrevista: 1000, rendaReal: 800, rendaDoMes: 1800, gastoReal: 300,
    entradas: { salarioRecebido: 0, salarioPrevisto: 1000, extras: 800, total: 800 },
    contasMes: 450, contasPagas: 250, contasFaltam: 200, gastoPrevisto: 550,
    // Fixture parcial (conta sem recorrência): nenhuma ocorrência a pagar → 1800 − 300.
    sobraDoMes: 1500, pctComprometida: 0.45, pagasNoPrazo: 0.5,
    vsMesAnterior: { gastoReal: { absoluto: 200, percentual: 2 } }, selo: 'Atenção',
  });
  expect(recebimentos.findByCompetencias).toHaveBeenCalledWith('u', ['2026-01', '2025-12']);
  expect(transacoesDoMes).toHaveBeenCalledWith('u', 2025, 12);
  expect(listarContasDoMes).toHaveBeenCalledWith('u', '2026-01', '2026-01-15');
});
it('sem dados/divisões por zero e fallback de renda prevista', async () => {
  vi.mocked(listarContasDoMes).mockResolvedValue([]);
  vi.mocked(orcamento.findAll).mockResolvedValue([]);
  vi.mocked(transacoesDoMes).mockResolvedValue([]);
  expect(await service.resumoFinanceiroMes('u', 2026, 1)).toMatchObject({ rendaDoMes: 1000, pagasNoPrazo: null, vsMesAnterior: null });
  vi.mocked(rendas.findAll).mockResolvedValue([]);
  expect(await service.resumoFinanceiroMes('u', 2026, 1)).toMatchObject({ selo: null, pctComprometida: null });
  await expect(service.resumoFinanceiroMes('u', 2026, 13)).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
});
it('CRUD valida entradas e preserva patches sem defaults', async () => {
  await service.listarRendas('u'); await service.listarOrcamento('u');
  await service.criarRenda('u', { descricao: 'Fixture', valor: 20 });
  expect(rendas.create).toHaveBeenCalledWith('u', { descricao: 'Fixture', valor: 20, ativo: true });
  await service.atualizarRenda('u', 'r', { valor: 30 });
  expect(rendas.update).toHaveBeenCalledWith('r', { valor: 30 }, 'u');
  await service.excluirRenda('u', 'r'); expect(rendas.remove).toHaveBeenCalledWith('r', 'u');
  const data = { categoria: 'Fixture', valor_planejado: 30 };
  await service.criarOrcamento('u', data); expect(orcamento.create).toHaveBeenCalledWith('u', data);
  await service.salvarOrcamento('u', data); expect(orcamento.upsert).toHaveBeenCalledWith('u', data);
  await service.atualizarOrcamento('u', 'o', { valor_planejado: 40 }); expect(orcamento.update).toHaveBeenCalledWith('o', { valor_planejado: 40 }, 'u');
  await service.excluirOrcamento('u', 'o'); expect(orcamento.remove).toHaveBeenCalledWith('o', 'u');
  await expect(service.criarRenda('u', { valor: -1 })).rejects.toThrow();
  await expect(service.salvarOrcamento('u', { categoria: '', valor_planejado: -1 })).rejects.toThrow();
  await expect(service.listarRendas('')).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
});

it('conta paga preserva valor/categoria mesmo quando pago_em cai em outro mês', async () => {
  vi.mocked(listarContasDoMes).mockResolvedValue([
    { conta: { categoria: 'Editada', valor: 900 }, vencimento: '2026-01-05', situacao: 'paga', pagamento: { transacao_id: 'historica', pago_em: '2025-12-31' } },
  ] as never);
  vi.mocked(transacoes.findByIds).mockResolvedValue([{ id: 'historica', categoria: 'Casa', valor: 200 }] as never);
  expect(await service.resumoFinanceiroMes('u', 2026, 1, '2026-01-15')).toMatchObject({ contasMes: 200, gastoPrevisto: 400 });
  expect(transacoes.findByIds).toHaveBeenCalledWith('u', ['historica']);
});

describe('R11: renda do mês não some com entrada extra (bug das linhas 53-54)', () => {
  beforeEach(() => {
    vi.mocked(listarContasDoMes).mockResolvedValue([]);
    vi.mocked(orcamento.findAll).mockResolvedValue([]);
    vi.mocked(rendas.findAll).mockResolvedValue([{ id: 'r', valor: 900, ativo: true }] as never);
  });
  it('renda 900 sem recebimento + extra 100 → renda 1.000 (nunca 100), também no mês anterior', async () => {
    vi.mocked(transacoesDoMes).mockResolvedValue([{ data: '2026-10-10', tipo: 'receita', valor: 100 }, { data: '2026-10-10', tipo: 'despesa', valor: 25 }] as never);
    const r = await service.resumoFinanceiroMes('u', 2026, 10, '2026-10-17');
    expect(r).toMatchObject({ rendaDoMes: 1000, rendaReal: 100, gastoReal: 25 });
  });
  it('com "Recebi" a renda fixa não conta duas vezes', async () => {
    vi.mocked(recebimentos.findByCompetencias).mockResolvedValue([{ renda_id: 'r', competencia: '2026-10' }] as never);
    vi.mocked(transacoesDoMes).mockImplementation(async (_, _ano, mes) =>
      (mes === 10 ? [{ data: '2026-10-10', tipo: 'receita', valor: 900 }, { data: '2026-10-10', tipo: 'receita', valor: 100 }] : []) as never);
    const r = await service.resumoFinanceiroMes('u', 2026, 10, '2026-10-17');
    expect(r).toMatchObject({ rendaDoMes: 1000, rendaReal: 1000 });
  });
  it('ajuste de saldo fica fora de renda e gasto', async () => {
    vi.mocked(transacoesDoMes).mockResolvedValue([
      { data: '2026-10-10', tipo: 'receita', valor: 300, ajuste: true }, { data: '2026-10-10', tipo: 'despesa', valor: 50, ajuste: true }, { data: '2026-10-10', tipo: 'despesa', valor: 10 },
    ] as never);
    expect(await service.resumoFinanceiroMes('u', 2026, 10, '2026-10-17')).toMatchObject({ rendaReal: 0, rendaDoMes: 900, gastoReal: 10 });
  });
});

describe('DIAG-CARD-ENTROU §5: Análise com as fórmulas corrigidas', () => {
  // Cenário do print (18/10): salário 943 sem Recebi, Pix 150, gastos 574, usuária começou em outubro.
  beforeEach(() => {
    vi.mocked(orcamento.findAll).mockResolvedValue([]);
    vi.mocked(rendas.findAll).mockResolvedValue([{ id: 'sal', valor: 943, ativo: true }] as never);
    vi.mocked(transacoesDoMes).mockImplementation(async (_, _ano, mes) =>
      (mes === 10 ? [{ id: 'pix', data: '2026-10-10', tipo: 'receita', valor: 150 }, { id: 'g', data: '2026-10-10', tipo: 'despesa', valor: 574 }] : []) as never);
    vi.mocked(listarContasDoMes).mockResolvedValue([
      // Venceu antes de a conta existir no app (cadastrada 10/10): não conta.
      { conta: { valor: 500, categoria: 'Casa', created_at: '2026-10-10T15:00:00Z' }, vencimento: '2026-10-05', situacao: 'vencida', pagamento: null },
      { conta: { valor: 344, categoria: 'Contas', created_at: '2026-10-10T15:00:00Z' }, vencimento: '2026-10-25', situacao: 'pendente', pagamento: null },
    ] as never);
  });

  it('Entrou: salário recebido 0 de 943 + extras 150 (o Pix não vira progresso do salário)', async () => {
    const r = await service.resumoFinanceiroMes('u', 2026, 10, '2026-10-18');
    expect(r.entradas).toEqual({ salarioRecebido: 0, salarioPrevisto: 943, extras: 150, total: 150 });
  });

  it('Entrou com Recebi 943 + Pix 150 → 943 de 943 e extras 150', async () => {
    vi.mocked(recebimentos.findByCompetencias).mockResolvedValue([{ renda_id: 'sal', competencia: '2026-10', transacao_id: 'rec' }] as never);
    vi.mocked(recebimentos.findByTransacoes).mockResolvedValue([{ renda_id: 'sal', competencia: '2026-10', transacao_id: 'rec' }] as never);
    vi.mocked(transacoesDoMes).mockImplementation(async (_, _ano, mes) =>
      (mes === 10 ? [{ id: 'rec', data: '2026-10-10', tipo: 'receita', valor: 943 }, { id: 'pix', data: '2026-10-10', tipo: 'receita', valor: 150 }] : []) as never);
    const r = await service.resumoFinanceiroMes('u', 2026, 10, '2026-10-18');
    expect(r.entradas).toEqual({ salarioRecebido: 943, salarioPrevisto: 943, extras: 150, total: 1093 });
  });

  it('comparação com setembro: null sem lançamento (não-ajuste) em setembro; com dados, existe', async () => {
    expect((await service.resumoFinanceiroMes('u', 2026, 10, '2026-10-18')).vsMesAnterior).toBeNull();
    vi.mocked(transacoesDoMes).mockImplementation(async (_, _ano, mes) =>
      (mes === 10 ? [{ id: 'g', data: '2026-10-10', tipo: 'despesa', valor: 574 }] : [{ id: 'aj', data: '2026-09-10', tipo: 'receita', valor: 9, ajuste: true }]) as never);
    expect((await service.resumoFinanceiroMes('u', 2026, 10, '2026-10-18')).vsMesAnterior).toBeNull();
    vi.mocked(transacoesDoMes).mockImplementation(async (_, _ano, mes) =>
      (mes === 10 ? [{ id: 'g', data: '2026-10-10', tipo: 'despesa', valor: 574 }] : [{ id: 's', data: '2026-09-10', tipo: 'despesa', valor: 474 }]) as never);
    expect((await service.resumoFinanceiroMes('u', 2026, 10, '2026-10-18')).vsMesAnterior).toEqual({ gastoReal: { absoluto: 100, percentual: 100 / 474 } });
  });

  it('pagas em dia: conta vencida antes do cadastro não conta; sem elegíveis → null (não 0%)', async () => {
    expect((await service.resumoFinanceiroMes('u', 2026, 10, '2026-10-18')).pagasNoPrazo).toBeNull();
  });

  it('pagas em dia: vencimento antes da âncora mais antiga das carteiras também não conta', async () => {
    vi.mocked(carteiras.findAll).mockResolvedValue([{ saldo_inicial_em: '2026-10-12T15:00:00Z' }, { saldo_inicial_em: '2026-10-08T15:00:00Z' }] as never);
    vi.mocked(listarContasDoMes).mockResolvedValue([
      { conta: { valor: 10, categoria: 'Casa', created_at: null }, vencimento: '2026-10-05', situacao: 'vencida', pagamento: null },
      { conta: { valor: 10, categoria: 'Casa', created_at: null }, vencimento: '2026-10-09', situacao: 'paga', pagamento: { pago_em: '2026-10-09' } },
    ] as never);
    expect((await service.resumoFinanceiroMes('u', 2026, 10, '2026-10-18')).pagasNoPrazo).toBe(1);
  });

  it('Saiu: contas do mês com pagas e faltam; uma sobra só (sem sobraReal)', async () => {
    const r = await service.resumoFinanceiroMes('u', 2026, 10, '2026-10-18');
    expect(r).toMatchObject({ gastoReal: 574, contasMes: 844, contasPagas: 0, contasFaltam: 844 });
    expect(r).not.toHaveProperty('sobraReal');
  });
});

describe('Revisão Codex 1: Recebi de outra competência com a receita no mês analisado', () => {
  // Banco "de verdade" dos recebimentos: cada busca devolve só o que o filtro pediria.
  const todos = [
    { id: 'atrasado', renda_id: 'sal', competencia: '2026-08', transacao_id: 'rec-ago' },
    { id: 'antecipado', renda_id: 'sal', competencia: '2026-11', transacao_id: 'rec-nov' },
  ];
  beforeEach(() => {
    vi.mocked(orcamento.findAll).mockResolvedValue([]);
    vi.mocked(listarContasDoMes).mockResolvedValue([]);
    vi.mocked(rendas.findAll).mockResolvedValue([{ id: 'sal', valor: 943, ativo: true }] as never);
    vi.mocked(recebimentos.findByCompetencias).mockImplementation(async (_u, comps) => todos.filter(r => comps.includes(r.competencia)) as never);
    vi.mocked(recebimentos.findByTransacoes).mockImplementation(async (_u, ids) => todos.filter(r => ids.includes(r.transacao_id)) as never);
  });

  it('salário de agosto recebido (atrasado) em outubro conta como salário, não como extra', async () => {
    vi.mocked(transacoesDoMes).mockImplementation(async (_, _ano, mes) =>
      (mes === 10 ? [{ id: 'rec-ago', data: '2026-10-10', tipo: 'receita', valor: 943 }, { id: 'pix', data: '2026-10-10', tipo: 'receita', valor: 150 }] : []) as never);
    const r = await service.resumoFinanceiroMes('u', 2026, 10, '2026-10-18');
    expect(r.entradas).toMatchObject({ salarioRecebido: 943, extras: 150 });
  });

  it('salário de novembro recebido antes (antecipado) em outubro conta como salário, não como extra', async () => {
    vi.mocked(transacoesDoMes).mockImplementation(async (_, _ano, mes) =>
      (mes === 10 ? [{ id: 'rec-nov', data: '2026-10-10', tipo: 'receita', valor: 943 }] : []) as never);
    const r = await service.resumoFinanceiroMes('u', 2026, 10, '2026-10-28');
    expect(r.entradas).toMatchObject({ salarioRecebido: 943, extras: 0 });
    expect(recebimentos.findByTransacoes).toHaveBeenCalledWith('u', ['rec-nov']);
  });
});


describe('PR A2: uma sobra só (sobraDoMes); sem "Sobra prevista"', () => {
  beforeEach(() => {
    vi.mocked(rendas.findAll).mockResolvedValue([{ id: 'r', valor: 1000, ativo: true, dia_recebimento: 5, created_at: null }] as never);
    vi.mocked(orcamento.findAll).mockResolvedValue([{ categoria: 'Lazer', valor_planejado: 100 }] as never);
    // Aluguel 200 vencido e sem Paguei; gastos lançados 900.
    vi.mocked(listarContasDoMes).mockResolvedValue([
      { conta: { id: 'c', descricao: 'Aluguel', categoria: 'Casa', valor: 200, ativo: true, recorrencia: 'mensal', dia_vencimento: 10, mes_vencimento: null, data_vencimento: null, created_at: null },
        vencimento: '2026-01-10', situacao: 'vencida', pagamento: null },
    ] as never);
    vi.mocked(transacoesDoMes).mockImplementation(async (_, ano) =>
      (ano === 2026 ? [{ id: 'm', data: '2026-01-08', tipo: 'despesa', categoria: 'Mercado', valor: 900, ajuste: false }] : []) as never);
  });

  it('resumo traz sobraDoMes (renda do mês − despesas − contas sem Paguei) e não traz sobraPrevista', async () => {
    const r = await service.resumoFinanceiroMes('u', 2026, 1, '2026-01-15');
    expect(r).not.toHaveProperty('sobraPrevista');
    // 1000 − (900 + 200) = −100 (a antiga "prevista" daria 1000 − 300 = 700).
    expect(r).toMatchObject({ sobraDoMes: -100, gastoPrevisto: 300 });
  });

  it('selo usa a sobra do mês: negativa → Apertado (com a prevista positiva seria Atenção)', async () => {
    expect((await service.resumoFinanceiroMes('u', 2026, 1, '2026-01-15')).selo).toBe('Apertado');
  });

  it('com o Paguei a conta sai das contas a pagar e entra uma vez só, como despesa lançada', async () => {
    vi.mocked(listarContasDoMes).mockResolvedValue([
      { conta: { id: 'c', descricao: 'Aluguel', categoria: 'Casa', valor: 200, ativo: true, recorrencia: 'mensal', dia_vencimento: 10, mes_vencimento: null, data_vencimento: null, created_at: null },
        vencimento: '2026-01-10', situacao: 'paga', pagamento: { conta_id: 'c', competencia: '2026-01', pago_em: '2026-01-10', transacao_id: 'p' } },
    ] as never);
    vi.mocked(transacoesDoMes).mockImplementation(async (_, ano) => (ano === 2026 ? [
      { id: 'm', data: '2026-01-08', tipo: 'despesa', categoria: 'Mercado', valor: 500, ajuste: false },
      { id: 'p', data: '2026-01-10', tipo: 'despesa', categoria: 'Casa', valor: 200, ajuste: false },
    ] : []) as never);
    const r = await service.resumoFinanceiroMes('u', 2026, 1, '2026-01-15');
    expect(r.sobraDoMes).toBe(300);
    expect(r.selo).toBe('No controle');
  });
});
