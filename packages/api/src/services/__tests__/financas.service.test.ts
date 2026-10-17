import { beforeEach, expect, it, vi } from 'vitest';
import * as service from '../financas.service';
import { pagamentosContaRepository as pagamentos, recebimentosRendaRepository as recebimentos, transacaoRepository as transacoes } from '../../repositories';
vi.mock('../../repositories', () => ({
  pagamentosContaRepository: { findByTransacoes: vi.fn() },
  recebimentosRendaRepository: { findByTransacoes: vi.fn() },
  transacaoRepository: { update: vi.fn(), remove: vi.fn(), findByDateRange: vi.fn() },
}));
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(pagamentos.findByTransacoes).mockResolvedValue([]);
  vi.mocked(recebimentos.findByTransacoes).mockResolvedValue([]);
});
it.each(['recebimento', 'pagamento'])('bloqueia edição/exclusão de %s com 409', async (tipo) => {
  vi.mocked(tipo === 'recebimento' ? recebimentos.findByTransacoes : pagamentos.findByTransacoes).mockResolvedValue([{ transacao_id: 't' }] as never);
  for (const operacao of [() => service.excluirTransacao('u', 't'), () => service.atualizarTransacao('u', 't', { valor: 20 })]) {
    await expect(operacao()).rejects.toMatchObject({ status: 409, code: 'TRANSACAO_VINCULADA', message: expect.stringContaining(`Desfazer ${tipo}`) });
  }
  expect(transacoes.update).not.toHaveBeenCalled();
  expect(transacoes.remove).not.toHaveBeenCalled();
  expect(recebimentos.findByTransacoes).toHaveBeenCalledWith('u', ['t']);
  expect(pagamentos.findByTransacoes).toHaveBeenCalledWith('u', ['t']);
});
it('permite lançamento comum', async () => {
  await service.excluirTransacao('u', 't');
  await service.atualizarTransacao('u', 't', { valor: 20 });
  expect(transacoes.remove).toHaveBeenCalledWith('t', 'u');
  expect(transacoes.update).toHaveBeenCalledWith('t', { valor: 20 }, 'u');
});
it('resumo mensal ignora ajustes positivos e negativos', async () => {
  vi.mocked(transacoes.findByDateRange).mockResolvedValue([
    { tipo: 'receita', valor: 100 }, { tipo: 'despesa', valor: 25 },
    { tipo: 'receita', valor: 900, ajuste: true }, { tipo: 'despesa', valor: 500, ajuste: true },
  ] as never);
  expect(await service.resumoMensal('u', 2026, 10)).toEqual({ totalReceitas: 100, totalDespesas: 25, saldo: 75 });
});
