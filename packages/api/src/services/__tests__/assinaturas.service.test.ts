import { beforeEach, expect, it, vi } from 'vitest';
import { assinaturaRepository as assinaturas, contasPagarRepository as contas } from '../../repositories';
import * as service from '../assinaturas.service';
vi.mock('../../repositories', () => ({
  assinaturaRepository: { findByUserId: vi.fn(), findById: vi.fn(), create: vi.fn(), update: vi.fn(), remove: vi.fn() },
  contasPagarRepository: { findByAssinatura: vi.fn(), create: vi.fn(), update: vi.fn() },
}));
const assinatura = { id: 'a', nome: 'Fixture', valor: 10, dia_vencimento: 31, ativo: true };
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(assinaturas.findByUserId).mockResolvedValue([assinatura] as never);
  vi.mocked(assinaturas.findById).mockResolvedValue(assinatura as never);
  vi.mocked(assinaturas.create).mockResolvedValue(assinatura as never);
  vi.mocked(assinaturas.update).mockImplementation(async (_, patch) => ({ ...assinatura, ...patch }) as never);
  vi.mocked(contas.findByAssinatura).mockResolvedValue(null);
});
it('cria um espelho, edita duas vezes sem duplicar e desativa sem apagar pagamentos', async () => {
  await service.criarAssinatura('u', assinatura);
  expect(contas.create).toHaveBeenCalledWith('u', expect.objectContaining({ assinatura_id: 'a', recorrencia: 'mensal', categoria: 'Assinaturas', ativo: true }));
  vi.mocked(contas.findByAssinatura).mockResolvedValue({ id: 'c' } as never);
  await service.atualizarAssinatura('u', 'a', { valor: 20 });
  await service.atualizarAssinatura('u', 'a', { ativo: false });
  expect(contas.create).toHaveBeenCalledTimes(1);
  expect(contas.update).toHaveBeenLastCalledWith('c', expect.objectContaining({ ativo: false }), 'u');
  await service.excluirAssinatura('u', 'a');
  expect(contas.update).toHaveBeenLastCalledWith('c', { ativo: false }, 'u');
  expect(assinaturas.remove).toHaveBeenCalledWith('a', 'u');
  expect(vi.mocked(contas.update).mock.invocationCallOrder.at(-1)).toBeLessThan(vi.mocked(assinaturas.remove).mock.invocationCallOrder[0]!);
  expect(service.ASSINATURA_INVALIDACOES).toContainEqual(['resumo-financeiro-mes']);
  // Assinatura espelha uma conta a pagar: muda a previsão de saldo.
  expect(service.ASSINATURA_INVALIDACOES).toContainEqual(['carteiras']);
});
it('vence hoje, ajusta dia 31 para fevereiro e trata lista vazia', async () => {
  const hoje = { ...assinatura, id: 'hoje', dia_vencimento: 15 };
  vi.mocked(assinaturas.findByUserId).mockResolvedValue([assinatura, hoje] as never);
  expect(await service.proximoVencimento('u', '2026-02-15')).toEqual(hoje);
  vi.mocked(assinaturas.findByUserId).mockResolvedValue([{ ...assinatura, id: 'dia1', dia_vencimento: 1 }, assinatura] as never);
  expect(await service.proximoVencimento('u', '2026-02-28')).toEqual(assinatura);
  vi.mocked(assinaturas.findByUserId).mockResolvedValue([]);
  expect(await service.proximoVencimento('u', '2026-02-28')).toBeNull();
});
it('não exclui assinatura quando falha ao desativar espelho', async () => {
  vi.mocked(contas.findByAssinatura).mockResolvedValue({ id: 'c' } as never);
  vi.mocked(contas.update).mockRejectedValue(new Error('fixture'));
  await expect(service.excluirAssinatura('u', 'a')).rejects.toThrow('fixture');
  expect(assinaturas.remove).not.toHaveBeenCalled();
});

it.each([1.001, 100000000, 0, -1])('valida valor %s antes de criar ou atualizar assinatura', async valor => {
  await expect(service.criarAssinatura('u', { ...assinatura, valor })).rejects.toThrow();
  await expect(service.atualizarAssinatura('u', 'a', { valor })).rejects.toThrow();
  expect(assinaturas.create).not.toHaveBeenCalled();
  expect(assinaturas.update).not.toHaveBeenCalled();
  expect(contas.findByAssinatura).not.toHaveBeenCalled();
});
