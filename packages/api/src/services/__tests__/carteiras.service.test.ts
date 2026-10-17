import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Carteira } from '@meudia/shared';
import * as service from '../carteiras.service';
import {
  carteirasRepository as carteiras,
  contasPagarRepository as contas,
  pagamentosContaRepository as pagamentos,
  recebimentosRendaRepository as recebimentos,
  rendasRepository as rendas,
  transacaoRepository as transacoes,
  transferenciasRepository as transferencias,
} from '../../repositories';

vi.mock('../../repositories', () => ({
  carteirasRepository: { rpcCorrigirSaldo: vi.fn(), findAll: vi.fn(), findById: vi.fn(), create: vi.fn(), update: vi.fn() },
  transacaoRepository: { create: vi.fn(), findComCarteiraDesde: vi.fn() },
  transferenciasRepository: { create: vi.fn(), findDesde: vi.fn(), remove: vi.fn() },
  recebimentosRendaRepository: { findByCompetencias: vi.fn(), rpcReceber: vi.fn(), rpcDesfazer: vi.fn() },
  rendasRepository: { findAll: vi.fn() },
  contasPagarRepository: { findAll: vi.fn() },
  pagamentosContaRepository: { findByCompetencias: vi.fn() },
}));

const HOJE = '2026-10-17';
const NU = 'c0060000-0000-4000-8000-0000000000a2';
const CX = 'c0060000-0000-4000-8000-0000000000a3';
const carteira = (id: string, nome: string, saldo: number, over: Partial<Carteira> = {}): Carteira => ({
  id, user_id: 'u', nome, tipo: 'banco', saldo_inicial: saldo, saldo_inicial_em: '2026-10-17T15:00:00Z',
  incluir_no_total: true, arquivada: false, ordem: 0, created_at: '2026-10-17T15:00:00Z', updated_at: null, ...over,
});

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(carteiras.findById).mockImplementation(async (id) => carteira(id, id === NU ? 'Nubank' : 'Caixa', 0));
  vi.mocked(transacoes.create).mockImplementation(async (_u, d) => ({ id: 't', ...d }) as never);
  vi.mocked(transacoes.findComCarteiraDesde).mockResolvedValue([]);
  vi.mocked(transferencias.findDesde).mockResolvedValue([]);
  vi.mocked(recebimentos.findByCompetencias).mockResolvedValue([]);
  vi.mocked(rendas.findAll).mockResolvedValue([]);
  vi.mocked(contas.findAll).mockResolvedValue([]);
  vi.mocked(pagamentos.findByCompetencias).mockResolvedValue([]);
});

describe('carteiras: cadastro', () => {
  it('cria com defaults (banco, no total) e não edita saldo pelo update', async () => {
    await service.criarCarteira('u', { nome: '  Nubank ', saldo_inicial: 650 });
    expect(carteiras.create).toHaveBeenCalledWith('u', { nome: 'Nubank', tipo: 'banco', saldo_inicial: 650, incluir_no_total: true });
    await service.atualizarCarteira('u', NU, { nome: 'Nu', saldo_inicial: 1 });
    expect(carteiras.update).toHaveBeenCalledWith(NU, { nome: 'Nu' }, 'u');
    await service.arquivarCarteira('u', NU);
    expect(carteiras.update).toHaveBeenLastCalledWith(NU, { arquivada: true }, 'u');
    await expect(service.criarCarteira('u', { nome: '' })).rejects.toThrow();
    await expect(service.criarCarteira('u', { nome: 'X', tipo: 'cartao' })).rejects.toThrow();
    await expect(service.listarCarteiras('')).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });
});

describe('Gastei / Entrou dinheiro / Transferir', () => {
  it('Gastei: despesa na carteira, descrição padrão = categoria', async () => {
    await service.gastei('u', { valor: 25, categoria: 'Comida', carteira_id: NU, data: HOJE }, HOJE);
    expect(transacoes.create).toHaveBeenCalledWith('u', {
      tipo: 'despesa', categoria: 'Comida', descricao: 'Comida', valor: 25, data: HOJE, carteira_id: NU, banco: 'Nubank', ajuste: false,
    });
  });
  it('Gastei: categoria padrão Outros; valor ≤ 0, sem carteira ou data futura são recusados', async () => {
    await service.gastei('u', { valor: 10, carteira_id: NU, data: '2026-10-10' }, HOJE);
    expect(transacoes.create).toHaveBeenLastCalledWith('u', expect.objectContaining({ categoria: 'Outros', descricao: 'Outros', data: '2026-10-10' }));
    await expect(service.gastei('u', { valor: 0, carteira_id: NU, data: HOJE }, HOJE)).rejects.toThrow();
    await expect(service.gastei('u', { valor: 5, data: HOJE }, HOJE)).rejects.toThrow();
    await expect(service.gastei('u', { valor: 5, carteira_id: NU, data: '2026-10-18' }, HOJE)).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    expect(transacoes.create).toHaveBeenCalledTimes(1);
  });
  it('carteira arquivada não recebe lançamento', async () => {
    vi.mocked(carteiras.findById).mockResolvedValue(carteira(NU, 'Nubank', 0, { arquivada: true }));
    await expect(service.gastei('u', { valor: 5, carteira_id: NU, data: HOJE }, HOJE)).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    expect(transacoes.create).not.toHaveBeenCalled();
  });
  it('Entrou dinheiro: receita "Entrada extra", descrição padrão "Entrada"', async () => {
    await service.entrouDinheiro('u', { valor: 100, carteira_id: CX, data: HOJE }, HOJE);
    expect(transacoes.create).toHaveBeenCalledWith('u', expect.objectContaining({
      tipo: 'receita', categoria: 'Entrada extra', descricao: 'Entrada', valor: 100, carteira_id: CX, ajuste: false,
    }));
  });
  it('Transferir: origem ≠ destino, valor > 0, data ≤ hoje; não cria transação', async () => {
    await service.transferir('u', { origem_id: CX, destino_id: NU, valor: 50, data: HOJE }, HOJE);
    expect(transferencias.create).toHaveBeenCalledWith('u', { origem_id: CX, destino_id: NU, valor: 50, data: HOJE, descricao: null });
    await expect(service.transferir('u', { origem_id: CX, destino_id: CX, valor: 50, data: HOJE }, HOJE)).rejects.toThrow();
    await expect(service.transferir('u', { origem_id: CX, destino_id: NU, valor: -1, data: HOJE }, HOJE)).rejects.toThrow();
    await expect(service.transferir('u', { origem_id: CX, destino_id: NU, valor: 1, data: '2026-10-20' }, HOJE)).rejects.toThrow();
    expect(transferencias.create).toHaveBeenCalledTimes(1);
    expect(transacoes.create).not.toHaveBeenCalled();
  });
});

describe('Corrigir saldo (R9)', () => {
  it('delega saldo e chave à RPC atômica, sem ler/inserir ajuste no cliente', async () => {
    const chave = crypto.randomUUID();
    vi.mocked(carteiras.rpcCorrigirSaldo).mockResolvedValue(null);
    expect(await service.corrigirSaldo('u', { carteira_id: NU, saldo_real: -80 }, HOJE, chave)).toBeNull();
    await service.corrigirSaldo('u', { carteira_id: NU, saldo_real: -80 }, HOJE, chave);
    expect(carteiras.rpcCorrigirSaldo).toHaveBeenCalledTimes(2);
    expect(carteiras.rpcCorrigirSaldo).toHaveBeenLastCalledWith(NU, -80, chave);
    expect(transacoes.create).not.toHaveBeenCalled();
    expect(transacoes.findComCarteiraDesde).not.toHaveBeenCalled();
  });
  it('gera UUID por tentativa quando a chave não foi informada', async () => {
    await service.corrigirSaldo('u', { carteira_id: NU, saldo_real: 10 }, HOJE);
    await service.corrigirSaldo('u', { carteira_id: NU, saldo_real: 10 }, HOJE);
    const chamadas = vi.mocked(carteiras.rpcCorrigirSaldo).mock.calls;
    expect(chamadas[0]![2]).toMatch(/^[0-9a-f-]{36}$/);
    expect(chamadas[0]![2]).not.toBe(chamadas[1]![2]);
  });
});

describe('Recebi (R6)', () => {
  it('valida e chama a RPC; carteira arquivada é recusada antes', async () => {
    await service.receberRenda('u', 'renda', { competencia: '2026-10', carteira_id: NU });
    expect(recebimentos.rpcReceber).toHaveBeenCalledWith('renda', '2026-10', undefined, NU);
    await service.desfazerRecebimento('u', 'renda', '2026-10');
    expect(recebimentos.rpcDesfazer).toHaveBeenCalledWith('renda', '2026-10');
    await expect(service.receberRenda('u', 'renda', { competencia: '2026-13' })).rejects.toThrow();
    await expect(service.desfazerRecebimento('u', 'renda', '10/2026')).rejects.toThrow();
    vi.mocked(carteiras.findById).mockResolvedValue(carteira(NU, 'Nubank', 0, { arquivada: true }));
    await expect(service.receberRenda('u', 'renda', { competencia: '2026-10', carteira_id: NU })).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    expect(recebimentos.rpcReceber).toHaveBeenCalledTimes(1);
  });
});

describe('painelSaldo', () => {
  it('monta hoje, chips, previsões, renda a receber e carteira padrão (BRIEF §5 passo 6)', async () => {
    vi.mocked(carteiras.findAll).mockResolvedValue([
      carteira(NU, 'Nubank', 650), carteira(CX, 'Caixa', 50, { ordem: 1 }),
      carteira('arq', 'Antiga', 999, { arquivada: true, ordem: 2 }),
    ]);
    vi.mocked(transacoes.findComCarteiraDesde).mockResolvedValue([
      { tipo: 'receita', valor: 100, data: HOJE, created_at: '2026-10-17T15:01:00Z', carteira_id: CX, ajuste: false },
      { tipo: 'despesa', valor: 25, data: HOJE, created_at: '2026-10-17T15:03:00Z', carteira_id: NU, ajuste: false },
    ] as never);
    vi.mocked(transferencias.findDesde).mockResolvedValue([
      { origem_id: CX, destino_id: NU, valor: 50, data: HOJE, created_at: '2026-10-17T15:02:00Z' },
    ] as never);
    vi.mocked(rendas.findAll).mockResolvedValue([
      { id: 'r', descricao: 'Salário', valor: 900, dia_recebimento: 5, ativo: true, created_at: '2026-10-17T15:04:00Z' },
    ] as never);
    vi.mocked(contas.findAll).mockResolvedValue([
      { id: 'luz', descricao: 'Luz', categoria: 'Luz', valor: 120, recorrencia: 'mensal', dia_vencimento: 20, ativo: true, created_at: '2026-10-17T15:00:00Z' },
      { id: 'net', descricao: 'Internet', categoria: 'Internet', valor: 100, recorrencia: 'mensal', dia_vencimento: 25, ativo: true, created_at: '2026-10-17T15:00:00Z' },
    ] as never);
    const p = await service.painelSaldo('u', HOJE);
    expect(p.saldoHoje).toBe(775);
    expect(p.carteiras.map((c) => [c.carteira.nome, c.saldo])).toEqual([['Nubank', 675], ['Caixa', 100]]);
    expect(p.arquivadas.map((c) => c.nome)).toEqual(['Antiga']);
    expect(p.previsao7.valor).toBe(1555);
    expect(p.previsaoFim.valor).toBe(1455);
    expect(p.rendasAReceber.map((r) => [r.renda.id, r.data])).toEqual([['r', '2026-10-05']]);
    expect(p.carteiraPadraoId).toBe(NU);
    expect(p.comecouMes).toBeNull();
    expect(transacoes.findComCarteiraDesde).toHaveBeenCalledWith('u', HOJE);
    expect(recebimentos.findByCompetencias).toHaveBeenCalledWith('u', ['2026-10']);
  });
  it('sem carteiras: não lê lançamentos; 7 dias cruzando o mês busca as duas competências', async () => {
    vi.mocked(carteiras.findAll).mockResolvedValue([]);
    const p = await service.painelSaldo('u', '2026-10-28');
    expect(p.saldoHoje).toBe(0);
    expect(p.carteiraPadraoId).toBeNull();
    expect(transacoes.findComCarteiraDesde).not.toHaveBeenCalled();
    // Sem âncora não há como saber o que já foi pago: só competências do mês corrente em diante.
    expect(pagamentos.findByCompetencias).toHaveBeenCalledWith('u', ['2026-10', '2026-11']);
  });
  it('previsão parte da âncora mais antiga das carteiras ativas: conta antiga sem Paguei não é descontada de novo', async () => {
    vi.mocked(carteiras.findAll).mockResolvedValue([
      carteira(NU, 'Nubank', 1000),
      carteira('arq', 'Antiga', 0, { arquivada: true, saldo_inicial_em: '2025-01-01T12:00:00Z' }),
    ]);
    vi.mocked(contas.findAll).mockResolvedValue([
      { id: 'al', descricao: 'Aluguel', categoria: 'Moradia', valor: 500, recorrencia: 'mensal', dia_vencimento: 10, ativo: true, created_at: '2025-01-01T12:00:00Z' },
    ] as never);
    const p = await service.painelSaldo('u', HOJE);
    expect(p.previsaoFim.itens.map((i) => i.competencia)).toEqual(['2026-10']);
    expect(p.previsaoFim.valor).toBe(500);
    expect(pagamentos.findByCompetencias).toHaveBeenCalledWith('u', ['2026-10']);
  });
});
