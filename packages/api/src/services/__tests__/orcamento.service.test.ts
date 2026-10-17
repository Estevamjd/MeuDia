import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as service from '../orcamento.service';
import { rendasRepository as rendas, orcamentoRepository as orcamento, transacaoRepository as transacoes, recebimentosRendaRepository as recebimentos } from '../../repositories';
import { listarContasDoMes } from '../contas-pagar.service';
import { transacoesDoMes } from '../financas.service';
vi.mock('../../repositories', () => ({
  transacaoRepository: { findByIds: vi.fn() },
  rendasRepository: { findAll: vi.fn(), create: vi.fn(), update: vi.fn(), remove: vi.fn() },
  orcamentoRepository: { findAll: vi.fn(), create: vi.fn(), upsert: vi.fn(), update: vi.fn(), remove: vi.fn() },
  recebimentosRendaRepository: { findByCompetencias: vi.fn() },
}));
vi.mock('../contas-pagar.service', () => ({ listarContasDoMes: vi.fn() }));
vi.mock('../financas.service', () => ({ transacoesDoMes: vi.fn() }));
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(rendas.findAll).mockResolvedValue([{ valor: 1000, ativo: true }] as never);
  vi.mocked(recebimentos.findByCompetencias).mockResolvedValue([]);
  vi.mocked(orcamento.findAll).mockResolvedValue([{ categoria: 'Casa', valor_planejado: 300 }, { categoria: 'Lazer', valor_planejado: 100 }] as never);
  vi.mocked(listarContasDoMes).mockResolvedValue([
    { conta: { categoria: 'Casa', valor: 200 }, vencimento: '2026-01-05', situacao: 'paga', pagamento: { pago_em: '2026-01-05' } },
    { conta: { categoria: 'Casa', valor: 200 }, vencimento: '2026-01-10', situacao: 'vencida', pagamento: null },
    { conta: { categoria: 'Outros', valor: 50 }, vencimento: '2026-01-25', situacao: 'paga', pagamento: { pago_em: '2026-01-12' } },
  ] as never);
  vi.mocked(transacoesDoMes).mockImplementation(async (_, ano, mes) => (ano === 2025 && mes === 12 ? [{ tipo: 'despesa', valor: 100 }] : [{ tipo: 'receita', valor: 800 }, { tipo: 'despesa', valor: 300 }]) as never);
});
it('fixture de janeiro: max por categoria, prazo, deltas e dezembro anterior', async () => {
  // R11: a receita de 800 soma por cima da renda fixa de 1000 sem "Recebi" (1800 − 300).
  expect(await service.resumoFinanceiroMes('u', 2026, 1, '2026-01-15')).toEqual({
    rendaPrevista: 1000, rendaReal: 800, rendaDoMes: 1800, gastoReal: 300, contasMes: 450, gastoPrevisto: 550,
    sobraPrevista: 450, sobraReal: 1500, pctComprometida: 0.45, pagasNoPrazo: 0.5,
    vsMesAnterior: { gastoReal: { absoluto: 200, percentual: 2 }, sobraReal: { absoluto: 600, percentual: 600 / 900 } }, selo: 'Atenção',
  });
  expect(recebimentos.findByCompetencias).toHaveBeenCalledWith('u', ['2026-01', '2025-12']);
  expect(transacoesDoMes).toHaveBeenCalledWith('u', 2025, 12);
  expect(listarContasDoMes).toHaveBeenCalledWith('u', '2026-01', '2026-01-15');
});
it('sem dados/divisões por zero e fallback de renda prevista', async () => {
  vi.mocked(listarContasDoMes).mockResolvedValue([]);
  vi.mocked(orcamento.findAll).mockResolvedValue([]);
  vi.mocked(transacoesDoMes).mockResolvedValue([]);
  expect(await service.resumoFinanceiroMes('u', 2026, 1)).toMatchObject({ sobraReal: 1000, pagasNoPrazo: null, vsMesAnterior: { gastoReal: { percentual: null } } });
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
    vi.mocked(transacoesDoMes).mockResolvedValue([{ tipo: 'receita', valor: 100 }, { tipo: 'despesa', valor: 25 }] as never);
    const r = await service.resumoFinanceiroMes('u', 2026, 10, '2026-10-17');
    expect(r).toMatchObject({ rendaDoMes: 1000, rendaReal: 100, gastoReal: 25, sobraReal: 975 });
    expect(r.vsMesAnterior.sobraReal).toEqual({ absoluto: 0, percentual: 0 });
  });
  it('com "Recebi" a renda fixa não conta duas vezes', async () => {
    vi.mocked(recebimentos.findByCompetencias).mockResolvedValue([{ renda_id: 'r', competencia: '2026-10' }] as never);
    vi.mocked(transacoesDoMes).mockImplementation(async (_, _ano, mes) =>
      (mes === 10 ? [{ tipo: 'receita', valor: 900 }, { tipo: 'receita', valor: 100 }] : []) as never);
    const r = await service.resumoFinanceiroMes('u', 2026, 10, '2026-10-17');
    expect(r).toMatchObject({ rendaDoMes: 1000, sobraReal: 1000 });
    // Setembro sem recebimento: a renda fixa conta como prevista.
    expect(r.vsMesAnterior.sobraReal.absoluto).toBe(100);
  });
  it('ajuste de saldo fica fora de renda e gasto', async () => {
    vi.mocked(transacoesDoMes).mockResolvedValue([
      { tipo: 'receita', valor: 300, ajuste: true }, { tipo: 'despesa', valor: 50, ajuste: true }, { tipo: 'despesa', valor: 10 },
    ] as never);
    expect(await service.resumoFinanceiroMes('u', 2026, 10, '2026-10-17')).toMatchObject({ rendaReal: 0, rendaDoMes: 900, gastoReal: 10, sobraReal: 890 });
  });
});
