import { beforeEach, expect, it, vi } from 'vitest';
import * as service from '../orcamento.service';
import { rendasRepository as rendas, orcamentoRepository as orcamento, transacaoRepository as transacoes } from '../../repositories';
import { listarContasDoMes } from '../contas-pagar.service';
import { transacoesDoMes } from '../financas.service';
vi.mock('../../repositories', () => ({
  transacaoRepository: { findByIds: vi.fn() },
  rendasRepository: { findAll: vi.fn(), create: vi.fn(), update: vi.fn(), remove: vi.fn() },
  orcamentoRepository: { findAll: vi.fn(), create: vi.fn(), upsert: vi.fn(), update: vi.fn(), remove: vi.fn() },
}));
vi.mock('../contas-pagar.service', () => ({ listarContasDoMes: vi.fn() }));
vi.mock('../financas.service', () => ({ transacoesDoMes: vi.fn() }));
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(rendas.findAll).mockResolvedValue([{ valor: 1000, ativo: true }] as never);
  vi.mocked(orcamento.findAll).mockResolvedValue([{ categoria: 'Casa', valor_planejado: 300 }, { categoria: 'Lazer', valor_planejado: 100 }] as never);
  vi.mocked(listarContasDoMes).mockResolvedValue([
    { conta: { categoria: 'Casa', valor: 200 }, vencimento: '2026-01-05', situacao: 'paga', pagamento: { pago_em: '2026-01-05' } },
    { conta: { categoria: 'Casa', valor: 200 }, vencimento: '2026-01-10', situacao: 'vencida', pagamento: null },
    { conta: { categoria: 'Outros', valor: 50 }, vencimento: '2026-01-25', situacao: 'paga', pagamento: { pago_em: '2026-01-12' } },
  ] as never);
  vi.mocked(transacoesDoMes).mockImplementation(async (_, ano, mes) => (ano === 2025 && mes === 12 ? [{ tipo: 'despesa', valor: 100 }] : [{ tipo: 'receita', valor: 800 }, { tipo: 'despesa', valor: 300 }]) as never);
});
it('fixture de janeiro: max por categoria, prazo, deltas e dezembro anterior', async () => {
  expect(await service.resumoFinanceiroMes('u', 2026, 1, '2026-01-15')).toEqual({
    rendaPrevista: 1000, rendaReal: 800, gastoReal: 300, contasMes: 450, gastoPrevisto: 550,
    sobraPrevista: 450, sobraReal: 500, pctComprometida: 0.45, pagasNoPrazo: 0.5,
    vsMesAnterior: { gastoReal: { absoluto: 200, percentual: 2 }, sobraReal: { absoluto: -400, percentual: -400 / 900 } }, selo: 'Atenção',
  });
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
