import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Carteira } from '@meudia/shared';
import * as service from '../carteiras.service';
import {
  carteirasRepository as carteiras,
  cofrinhoRepository as cofrinho,
  contasPagarRepository as contas,
  pagamentosContaRepository as pagamentos,
  recebimentosRendaRepository as recebimentos,
  rendasRepository as rendas,
  transacaoRepository as transacoes,
  transferenciasRepository as transferencias,
} from '../../repositories';

vi.mock('../../repositories', () => ({
  carteirasRepository: { rpcResumoPainelSaldo: vi.fn(), rpcSaldosCarteirasEm: vi.fn(), rpcCorrigirSaldo: vi.fn(), findAll: vi.fn(), findById: vi.fn(), create: vi.fn(), update: vi.fn(), remove: vi.fn() },
  transacaoRepository: { create: vi.fn(), findComCarteiraDesde: vi.fn(), findByDateRange: vi.fn(), findByIds: vi.fn() },
  transferenciasRepository: { findAll: vi.fn(), findEntre: vi.fn(), create: vi.fn(), findDesde: vi.fn(), remove: vi.fn() },
  recebimentosRendaRepository: { findByCompetencias: vi.fn(), rpcReceber: vi.fn(), rpcDesfazer: vi.fn() },
  rendasRepository: { findAll: vi.fn() },
  contasPagarRepository: { findAll: vi.fn() },
  pagamentosContaRepository: { findByCompetencias: vi.fn(), findByTransacoes: vi.fn() },
  cofrinhoRepository: { carregar: vi.fn(), rpcIniciar: vi.fn() },
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
  vi.mocked(carteiras.rpcResumoPainelSaldo).mockResolvedValue(null);
  vi.mocked(carteiras.rpcSaldosCarteirasEm).mockResolvedValue(null);
  vi.mocked(carteiras.findById).mockImplementation(async (id) => carteira(id, id === NU ? 'Nubank' : 'Caixa', 0));
  vi.mocked(transacoes.create).mockImplementation(async (_u, d) => ({ id: 't', ...d }) as never);
  vi.mocked(transacoes.findComCarteiraDesde).mockResolvedValue([]);
  vi.mocked(transferencias.findDesde).mockResolvedValue([]);
  vi.mocked(recebimentos.findByCompetencias).mockResolvedValue([]);
  vi.mocked(rendas.findAll).mockResolvedValue([]);
  vi.mocked(contas.findAll).mockResolvedValue([]);
  vi.mocked(pagamentos.findByCompetencias).mockResolvedValue([]);
  vi.mocked(pagamentos.findByTransacoes).mockResolvedValue([]);
  vi.mocked(transacoes.findByDateRange).mockResolvedValue([]);
  vi.mocked(transacoes.findByIds).mockResolvedValue([]);
  vi.mocked(cofrinho.carregar).mockResolvedValue({ movimentos: [], fechamentos: [] });
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
  it('monta hoje, chips, entradas da sobra do mês, renda a receber e carteira padrão (BRIEF §5 passo 6)', async () => {
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
    expect(p.mes.rendas.map((r) => r.id)).toEqual(['r']);
    expect(p.mes.contas.map((c) => c.id)).toEqual(['luz', 'net']);
    expect(p.rendasAReceber.map((r) => [r.renda.id, r.data])).toEqual([['r', '2026-10-05']]);
    expect(p.carteiraPadraoId).toBe(NU);
    expect(p.comecouMes).toBeNull();
    expect(transacoes.findComCarteiraDesde).toHaveBeenCalledWith('u', HOJE);
    expect(recebimentos.findByCompetencias).toHaveBeenCalledWith('u', ['2026-09', '2026-10']);
  });
  it('sem carteiras: não lê saldo de banco nem inicia o Cofrinho; lê o mês anterior e o atual', async () => {
    vi.mocked(carteiras.findAll).mockResolvedValue([]);
    const p = await service.painelSaldo('u', '2026-10-28');
    expect(p.saldoHoje).toBe(0);
    expect(p.carteiraPadraoId).toBeNull();
    expect(transacoes.findComCarteiraDesde).not.toHaveBeenCalled();
    expect(transacoes.findByDateRange).toHaveBeenCalledWith('u', '2026-09-01', '2026-10-31');
    expect(recebimentos.findByCompetencias).toHaveBeenCalledWith('u', ['2026-09', '2026-10']);
    expect(pagamentos.findByCompetencias).toHaveBeenCalledWith('u', ['2026-09', '2026-10']);
    expect(cofrinho.rpcIniciar).not.toHaveBeenCalled();
    expect(p.cofrinho).toEqual({ saldo: 0, inicioEm: null, respondidas: [], movimentos: [] });
  });
  it('Cofrinho: soma os movimentos; gasto no banco não muda; primeiro acesso com banco congela o ponto de partida', async () => {
    vi.mocked(carteiras.findAll).mockResolvedValue([carteira(NU, 'Nubank', 235)]);
    const inicial = { id: 'm1', user_id: 'u', tipo: 'inicial', valor: 150, competencia: null, chave: null, valor_informado: null, created_at: '2026-11-19T15:00:00Z' } as const;
    vi.mocked(cofrinho.carregar)
      .mockResolvedValueOnce({ movimentos: [], fechamentos: [] })
      .mockResolvedValueOnce({ movimentos: [inicial, { ...inicial, id: 'm2', tipo: 'guardar', valor: 50 }], fechamentos: [{ user_id: 'u', competencia: '2026-10', decisao: 'agora_nao', valor: null, created_at: '' }] });
    vi.mocked(transacoes.findComCarteiraDesde).mockResolvedValue([{ id: 'g', tipo: 'despesa', valor: 100, data: HOJE, carteira_id: NU, created_at: '2026-10-17T16:00:00Z', ajuste: false }] as never);
    const p = await service.painelSaldo('u', HOJE);
    expect(cofrinho.rpcIniciar).toHaveBeenCalledTimes(1);
    expect(p.saldoHoje).toBe(135);
    expect(p.cofrinho).toMatchObject({ saldo: 200, inicioEm: '2026-11-19T15:00:00Z', respondidas: ['2026-10'] });
  });
  it('banco sem a 014: cofrinho null (a tela mostra o total dos bancos)', async () => {
    vi.mocked(cofrinho.carregar).mockResolvedValue(null);
    vi.mocked(carteiras.findAll).mockResolvedValue([carteira(NU, 'Nubank', 235)]);
    const p = await service.painelSaldo('u', HOJE);
    expect(p.cofrinho).toBeNull();
    expect(cofrinho.rpcIniciar).not.toHaveBeenCalled();
  });
  it('"Paguei" (inclusive com data fora da janela) vira transacoesDeContas; sobra do mês anterior usa o mesmo modelo', async () => {
    vi.mocked(carteiras.findAll).mockResolvedValue([]);
    vi.mocked(rendas.findAll).mockResolvedValue([
      { id: 'r', descricao: 'Salário', valor: 2000, dia_recebimento: 1, ativo: true, created_at: '2026-08-01T15:00:00Z' },
    ] as never);
    vi.mocked(contas.findAll).mockResolvedValue([
      { id: 'tab', descricao: 'Tablet', categoria: 'Contas', valor: 100, recorrencia: 'mensal', dia_vencimento: 1, ativo: true, created_at: '2026-08-01T15:00:00Z' },
    ] as never);
    vi.mocked(transacoes.findByDateRange).mockResolvedValue([
      { id: 'tTab', tipo: 'despesa', valor: 100, data: '2026-09-30', ajuste: false },
      { id: 'tMerc', tipo: 'despesa', valor: 30, data: '2026-09-12', ajuste: false },
    ] as never);
    vi.mocked(pagamentos.findByTransacoes).mockResolvedValue([{ conta_id: 'tab', competencia: '2026-10', transacao_id: 'tTab' }] as never);
    vi.mocked(pagamentos.findByCompetencias).mockResolvedValue([
      { conta_id: 'tab', competencia: '2026-10', transacao_id: 'tTab', pago_em: '2026-09-30' },
      { conta_id: 'tab', competencia: '2026-09', transacao_id: 'tVelha', pago_em: '2026-08-31' },
    ] as never);
    vi.mocked(transacoes.findByIds).mockResolvedValue([{ id: 'tVelha', tipo: 'despesa', valor: 95, data: '2026-08-31' }] as never);
    const p = await service.painelSaldo('u', HOJE);
    expect(transacoes.findByIds).toHaveBeenCalledWith('u', ['tVelha']);
    expect(p.mes.transacoesDeContas).toEqual({ tTab: 100, tVelha: 95 });
    expect(p.mes.pagamentos.map((x) => x.competencia)).toEqual(['2026-10']);
    // Setembro: 2000 (previsão) − Tablet pago 95 − mercado 30 (o Tablet de outubro pago em 30/09 não é extra).
    expect(p.mesAnterior).toEqual({ competencia: '2026-09', sobra: 1875 });
  });
  it('Recebi da competência tira a renda de "a receber"; recebimento de outra competência não', async () => {
    vi.mocked(carteiras.findAll).mockResolvedValue([carteira(NU, 'Nubank', 235)]);
    vi.mocked(rendas.findAll).mockResolvedValue([
      { id: 'r', descricao: 'Salário', valor: 2200, dia_recebimento: 1, ativo: true, created_at: '2026-10-16T15:00:00Z' },
      { id: 'r2', descricao: 'Bico', valor: 300, dia_recebimento: 20, ativo: true, created_at: '2026-10-16T15:00:00Z' },
    ] as never);
    vi.mocked(recebimentos.findByCompetencias).mockResolvedValue([{ renda_id: 'r', competencia: '2026-10' }] as never);
    const p = await service.painelSaldo('u', HOJE);
    expect(p.rendasAReceber.map((r) => r.renda.id)).toEqual(['r2']);
    expect(p.mes.recebimentos).toEqual([{ renda_id: 'r', competencia: '2026-10' }]);
  });
});

describe('excluir banco (007)', () => {
  it('excluirCarteira apaga pelo repositório (lançamentos/rendas/transferências ficam a cargo das FKs da 007)', async () => {
    await service.excluirCarteira('u', NU);
    expect(carteiras.remove).toHaveBeenCalledWith(NU, 'u');
    await expect(service.excluirCarteira('', NU)).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });
});

it('painel agregado equivale ao legado e não baixa históricos nem carteiras', async () => {
  const cs = [carteira(NU, 'Nu', 150), carteira(CX, 'Caixa', 20, { arquivada: true })];
  vi.mocked(carteiras.findAll).mockResolvedValue(cs);
  const legado = await service.painelSaldo('u', HOJE);
  vi.mocked(carteiras.rpcResumoPainelSaldo).mockResolvedValue({ carteiras: cs.map((c) => ({ ...c, saldo: c.saldo_inicial, saldo_fim_mes_anterior: c.saldo_inicial })), ultimaCarteiraId: null });
  vi.mocked(carteiras.findAll).mockClear();
  vi.mocked(transacoes.findComCarteiraDesde).mockClear();
  vi.mocked(transferencias.findDesde).mockClear();
  const rapido = await service.painelSaldo('u', HOJE);
  expect(rapido).toEqual(legado);
  expect(rapido).not.toHaveProperty('transacoesCarteiras');
  expect(rapido).not.toHaveProperty('transferencias');
  expect(carteiras.findAll).not.toHaveBeenCalled();
  expect(transacoes.findComCarteiraDesde).not.toHaveBeenCalled();
  expect(transferencias.findDesde).not.toHaveBeenCalled();
});

it('histórico mensal usa RPC e lê transferências só no intervalo do mês', async () => {
  vi.mocked(carteiras.rpcSaldosCarteirasEm).mockResolvedValue({ [NU]: 12.34 });
  vi.mocked(transferencias.findEntre).mockResolvedValue([]);
  expect(await service.historicoSaldoMes('u', '2026-11')).toEqual({ bases: { [NU]: 12.34 }, transferencias: [] });
  expect(carteiras.rpcSaldosCarteirasEm).toHaveBeenCalledWith('2026-10-31');
  expect(transferencias.findEntre).toHaveBeenCalledWith('u', '2026-11-01', '2026-11-30');
  expect(carteiras.findAll).not.toHaveBeenCalled();
  expect(transacoes.findComCarteiraDesde).not.toHaveBeenCalled();
});

it('histórico mensal sem 015 calcula a mesma base pelo legado', async () => {
  vi.mocked(carteiras.findAll).mockResolvedValue([carteira(NU, 'Nu', 100, { saldo_inicial_em: '2026-10-01T12:00:00Z' })]);
  vi.mocked(transacoes.findComCarteiraDesde).mockResolvedValue([{ carteira_id: NU, tipo: 'despesa', valor: 30, data: '2026-10-10' }] as never);
  vi.mocked(transferencias.findEntre).mockResolvedValue([]);
  expect(await service.historicoSaldoMes('u', '2026-11')).toEqual({ bases: { [NU]: 70 }, transferencias: [] });
});

it('lista transferências independente do painel e valida o usuário', async () => {
  vi.mocked(transferencias.findAll).mockResolvedValue([]);
  expect(await service.transferenciasRecentes('u')).toEqual([]);
  expect(transferencias.findAll).toHaveBeenCalledWith('u');
  await expect(service.transferenciasRecentes('')).rejects.toThrow();
  await expect(service.historicoSaldoMes('u', 'inválido')).rejects.toThrow();
});

it('equivalência do painel com os números fixos do teste SQL 015', async () => {
  const cs = [
    carteira(NU, 'Banco 1', 240, { saldo_inicial_em: '2026-10-18T05:00:00Z' }),
    carteira(CX, 'Banco 2', 50, { saldo_inicial_em: '2026-10-18T05:00:00Z' }),
    carteira('fora', 'Fora', 1000, { saldo_inicial_em: '2026-10-18T05:00:00Z', incluir_no_total: false }),
    carteira('arquivada', 'Arquivado', 500, { saldo_inicial_em: '2026-10-18T05:00:00Z', arquivada: true }),
  ];
  const t = (id: string, carteira_id: string, tipo: string, valor: number, data: string, created_at: string, ajuste = false) => ({ id, carteira_id, tipo, valor, data, created_at, ajuste });
  vi.mocked(carteiras.findAll).mockResolvedValue(cs);
  vi.mocked(transacoes.findComCarteiraDesde).mockResolvedValue([
    t('before', NU, 'despesa', 100, '2026-10-16', '2026-10-17T00:08:00Z'),
    t('samebefore', NU, 'despesa', 7, '2026-10-18', '2026-10-18T04:30:00Z'),
    t('sameafter', NU, 'despesa', 5, '2026-10-18', '2026-10-18T06:00:00Z'),
    t('ms', NU, 'receita', 999, '2026-10-18', '2026-10-18T05:00:00.000999Z'),
    t('adj1', NU, 'despesa', 20.10, '2026-10-25', '2026-10-25T19:28:38Z', true),
    t('adj2', NU, 'receita', 11.87, '2026-10-31', '2026-10-31T03:14:58Z', true),
    t('b2', CX, 'despesa', 20, '2026-11-05', '2026-11-05T17:59:32Z'),
    t('out', 'fora', 'despesa', 300, '2026-11-05', '2026-11-05T17:59:32Z'),
    t('future', NU, 'despesa', 999, '2027-01-01', '2027-01-01T12:00:00Z'),
  ] as never);
  vi.mocked(transferencias.findDesde).mockResolvedValue([
    { origem_id: NU, destino_id: CX, valor: 30, data: '2026-11-01' },
    { origem_id: 'fora', destino_id: NU, valor: 40, data: '2026-11-02' },
    { origem_id: null, destino_id: NU, valor: 3, data: '2026-11-03' },
    { origem_id: NU, destino_id: null, valor: 2, data: '2026-11-03' },
    { origem_id: null, destino_id: NU, valor: 999, data: '2026-10-18', created_at: '2026-10-18T05:00:00.000999Z' },
    { origem_id: null, destino_id: NU, valor: 999, data: '2027-01-01' },
  ] as never);
  const legado = await service.painelSaldo('u', '2026-11-20');
  const valores = [237.77, 60, 660, 500];
  const anteriores = [226.77, 50, 1000, 500];
  vi.mocked(carteiras.rpcResumoPainelSaldo).mockResolvedValue({ carteiras: cs.map((c, i) => ({ ...c, saldo: valores[i]!, saldo_fim_mes_anterior: anteriores[i]! })), ultimaCarteiraId: NU });
  const rapido = await service.painelSaldo('u', '2026-11-20');
  expect(rapido).toEqual(legado);
  expect(rapido.saldoHoje).toBe(297.77);
  expect(rapido.comecouMes).toBe(276.77);
});
