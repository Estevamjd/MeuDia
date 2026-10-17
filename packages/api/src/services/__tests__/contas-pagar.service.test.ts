import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ContaPagar, PagamentoConta } from '@meudia/shared';
import { contasPagarRepository as contas, pagamentosContaRepository as pagamentos } from '../../repositories';
import * as service from '../contas-pagar.service';

vi.mock('../../repositories', () => ({
  contasPagarRepository: { findAll: vi.fn(), findById: vi.fn(), create: vi.fn(), update: vi.fn(), rpcPagar: vi.fn(), rpcDesfazer: vi.fn() },
  pagamentosContaRepository: { findByCompetencia: vi.fn(), findByConta: vi.fn() },
}));

const conta: ContaPagar = {
  id: 'conta', user_id: 'user', assinatura_id: null, descricao: 'Conta', categoria: 'Contas', valor: 10,
  recorrencia: 'mensal', dia_vencimento: 15, mes_vencimento: null, data_vencimento: null,
  ativo: true, created_at: '2026-09-01T03:00:00Z', updated_at: null,
};
const pagamento: PagamentoConta = {
  id: 'pagamento', conta_id: 'conta', user_id: 'user', competencia: '2026-10', pago_em: '2026-10-14', transacao_id: 'transacao', created_at: null,
};
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(contas.findAll).mockResolvedValue([conta]);
  vi.mocked(contas.findById).mockResolvedValue(conta);
  vi.mocked(pagamentos.findByCompetencia).mockImplementation(async (_, comp) => comp === '2026-10' ? [pagamento] : []);
  vi.mocked(pagamentos.findByConta).mockResolvedValue([pagamento]);
});
describe('BE-04: contas service', () => {
  it('pagamento de outubro não paga novembro; listar não escreve', async () => {
    expect((await service.listarContasDoMes('user', '2026-10', '2026-10-16'))[0]).toMatchObject({ situacao: 'paga', pagamento });
    expect((await service.listarContasDoMes('user', '2026-11', '2026-11-15'))[0]).toMatchObject({ situacao: 'pendente', pagamento: null });
    for (const method of [contas.create, contas.update, contas.rpcPagar, contas.rpcDesfazer]) expect(method).not.toHaveBeenCalled();
  });
  it('vencida apenas quando vencimento é anterior a hoje', async () => {
    expect((await service.listarContasDoMes('user', '2026-11', '2026-11-16'))[0]?.situacao).toBe('vencida');
    expect((await service.listarContasDoMes('user', '2026-11', '2026-11-15'))[0]?.situacao).toBe('pendente');
  });
  it('inativa aparece apenas com pagamento na competência', async () => {
    vi.mocked(contas.findAll).mockResolvedValue([{ ...conta, ativo: false }]);
    expect((await service.listarContasDoMes('user', '2026-10', '2026-10-16'))[0]?.situacao).toBe('paga');
    expect(await service.listarContasDoMes('user', '2026-11', '2026-11-16')).toEqual([]);
  });
  it('mantém pagamento visível mesmo após edição de recorrência', async () => {
    vi.mocked(contas.findAll).mockResolvedValue([{ ...conta, recorrencia: 'anual', mes_vencimento: 11 }]);
    expect((await service.listarContasDoMes('user', '2026-10'))[0]).toMatchObject({ situacao: 'paga', pagamento });
  });
  it('obtém ocorrência e histórico de conta inativa', async () => {
    vi.mocked(contas.findById).mockResolvedValue({ ...conta, ativo: false });
    expect(await service.obterContaDoMes('user', 'conta', '2026-10')).toMatchObject({ pagamento, historico: [pagamento] });
    expect(pagamentos.findByConta).toHaveBeenCalledWith('user', 'conta');
    await expect(service.obterContaDoMes('user', 'conta', '2026-11')).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
  it('desativar só atualiza ativo, preservando pagamentos', async () => {
    await service.desativarConta('user', 'conta');
    expect(contas.update).toHaveBeenCalledTimes(1);
    expect(contas.update).toHaveBeenCalledWith('conta', { ativo: false }, 'user');
    expect(contas.rpcDesfazer).not.toHaveBeenCalled();
    expect(pagamentos.findByConta).not.toHaveBeenCalled();
  });
  it('cria com defaults e valida antes de escrever', async () => {
    await service.criarConta('user', { descricao: 'Conta', valor: 10, recorrencia: 'mensal', dia_vencimento: 15 });
    expect(contas.create).toHaveBeenCalledWith('user', expect.objectContaining({ categoria: 'Contas', ativo: true }));
    await expect(service.criarConta('user', { valor: -1 })).rejects.toThrow();
    expect(contas.create).toHaveBeenCalledTimes(1);
  });
  it('patch parcial não sobrescreve defaults nem pagamentos; valida CHECK completo', async () => {
    await service.atualizarConta('user', 'conta', { valor: 20 });
    expect(contas.update).toHaveBeenCalledWith('conta', { valor: 20 }, 'user');
    await expect(service.atualizarConta('user', 'conta', { recorrencia: 'anual' })).rejects.toThrow();
    expect(contas.update).toHaveBeenCalledTimes(1);
    expect(contas.rpcPagar).not.toHaveBeenCalled();
    expect(contas.rpcDesfazer).not.toHaveBeenCalled();
  });
  it('pagar/desfazer validam e chamam RPCs', async () => {
    vi.mocked(contas.rpcPagar).mockResolvedValue(pagamento);
    expect(await service.pagarConta('user', 'conta', { competencia: '2026-10', pago_em: '2026-10-14', banco: null })).toEqual(pagamento);
    expect(contas.rpcPagar).toHaveBeenCalledWith('conta', '2026-10', '2026-10-14', null, undefined);
    const carteira = 'c0060000-0000-4000-8000-0000000000a2';
    await service.pagarConta('user', 'conta', { competencia: '2026-10', carteira_id: carteira });
    expect(contas.rpcPagar).toHaveBeenLastCalledWith('conta', '2026-10', undefined, undefined, undefined, carteira);
    await service.desfazerPagamento('user', 'conta', '2026-10');
    expect(contas.rpcDesfazer).toHaveBeenCalledWith('conta', '2026-10');
    await expect(service.pagarConta('user', 'conta', { competencia: '2026-13' })).rejects.toThrow();
    await expect(service.desfazerPagamento('user', 'conta', '2026-1')).rejects.toThrow();
    expect(contas.rpcPagar).toHaveBeenCalledTimes(2);
    expect(contas.rpcDesfazer).toHaveBeenCalledTimes(1);
  });
  it('não chama RPC para conta inacessível', async () => {
    vi.mocked(contas.findById).mockRejectedValue(new Error('inacessível'));
    await expect(service.pagarConta('user', 'conta', { competencia: '2026-10' })).rejects.toThrow('inacessível');
    await expect(service.desfazerPagamento('user', 'conta', '2026-10')).rejects.toThrow('inacessível');
    expect(contas.rpcPagar).not.toHaveBeenCalled();
    expect(contas.rpcDesfazer).not.toHaveBeenCalled();
  });
  it('rejeita usuário vazio e competência inválida antes de consultar', async () => {
    await expect(service.listarContasDoMes('', '2026-10')).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    await expect(service.listarContasDoMes('user', '2026-13')).rejects.toThrow();
    expect(contas.findAll).not.toHaveBeenCalled();
  });
});
