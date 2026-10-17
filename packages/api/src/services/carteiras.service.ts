import type { Carteira, Renda, Transacao, Transferencia } from '@meudia/shared';
import {
  AppError,
  CATEGORIA_ENTRADA_EXTRA,
  alvosPrevisao,
  ancoraPrevisao,
  competenciaDe,
  competenciasPrevisao,
  comecouMesCom,
  dataAncora,
  dataRendaNoMes,
  hojeSP,
  previsao,
  saldoCarteira,
  saldoHoje,
  saldosCarteiras,
} from '@meudia/shared';
import {
  carteirasRepository,
  contasPagarRepository,
  pagamentosContaRepository,
  recebimentosRendaRepository,
  rendasRepository,
  transacaoRepository,
  transferenciasRepository,
} from '../repositories';
import {
  carteiraInsertSchema,
  carteiraUpdateSchema,
  competenciaSchema,
  corrigirSaldoSchema,
  entradaAvulsaSchema,
  gastoRapidoSchema,
  receberRendaSchema,
  transferenciaInsertSchema,
} from '../validators';

function usuario(userId: string) {
  if (!userId) throw new AppError('userId é obrigatório', 'VALIDATION_ERROR', 400);
}

/** R4/R5/R7: lançamentos manuais não podem ser no futuro (hoje em SP). */
function semFuturo(data: string, hojeISO: string) {
  if (data > hojeISO) throw new AppError('A data não pode ser depois de hoje', 'VALIDATION_ERROR', 400);
}

async function carteiraAtiva(userId: string, id: string): Promise<Carteira> {
  const carteira = await carteirasRepository.findById(id, userId);
  if (carteira.arquivada) throw new AppError('Carteira arquivada', 'VALIDATION_ERROR', 400);
  return carteira;
}

export async function listarCarteiras(userId: string) {
  usuario(userId);
  return carteirasRepository.findAll(userId);
}

export async function criarCarteira(userId: string, data: unknown) {
  usuario(userId);
  return carteirasRepository.create(userId, carteiraInsertSchema.parse(data));
}

export async function atualizarCarteira(userId: string, id: string, data: unknown) {
  usuario(userId);
  return carteirasRepository.update(id, carteiraUpdateSchema.parse(data), userId);
}

/** R1: não existe excluir, só arquivar (sai do total e dos seletores; o histórico fica). */
export async function arquivarCarteira(userId: string, id: string, arquivada = true) {
  usuario(userId);
  return carteirasRepository.update(id, { arquivada }, userId);
}

/** R5 "Gastei": despesa na carteira; descrição padrão = nome da categoria. */
export async function gastei(userId: string, data: unknown, hojeISO = hojeSP()) {
  usuario(userId);
  const g = gastoRapidoSchema.parse(data);
  semFuturo(g.data, hojeISO);
  const carteira = await carteiraAtiva(userId, g.carteira_id);
  return transacaoRepository.create(userId, {
    tipo: 'despesa', categoria: g.categoria, descricao: g.descricao || g.categoria, valor: g.valor,
    data: g.data, carteira_id: carteira.id, banco: carteira.nome, ajuste: false,
  });
}

/** R4 "Entrou dinheiro": receita avulsa (soma no saldo e na renda do mês). */
export async function entrouDinheiro(userId: string, data: unknown, hojeISO = hojeSP()) {
  usuario(userId);
  const e = entradaAvulsaSchema.parse(data);
  semFuturo(e.data, hojeISO);
  const carteira = await carteiraAtiva(userId, e.carteira_id);
  return transacaoRepository.create(userId, {
    tipo: 'receita', categoria: CATEGORIA_ENTRADA_EXTRA, descricao: e.descricao || 'Entrada', valor: e.valor,
    data: e.data, carteira_id: carteira.id, banco: carteira.nome, ajuste: false,
  });
}

/** R7: não conta como gasto nem renda (fica fora de `transacoes`). */
export async function transferir(userId: string, data: unknown, hojeISO = hojeSP()) {
  usuario(userId);
  const t = transferenciaInsertSchema.parse(data);
  semFuturo(t.data, hojeISO);
  await Promise.all([carteiraAtiva(userId, t.origem_id), carteiraAtiva(userId, t.destino_id)]);
  return transferenciasRepository.create(userId, { ...t, descricao: t.descricao || null });
}

export async function excluirTransferencia(userId: string, id: string) {
  usuario(userId);
  return transferenciasRepository.remove(id, userId);
}

/** Saldo atual de uma carteira (lançamentos desde a âncora até hoje). */
export async function saldoDaCarteira(userId: string, carteira: Carteira, hojeISO = hojeSP()) {
  const desde = dataAncora(carteira);
  const [transacoes, transferencias] = await Promise.all([
    transacaoRepository.findComCarteiraDesde(userId, desde), transferenciasRepository.findDesde(userId, desde),
  ]);
  return saldoCarteira(carteira, transacoes, transferencias, hojeISO);
}

/**
 * R9 "Corrigir saldo": cria um ajuste com a diferença (receita ou despesa, `ajuste=true`).
 * Sem diferença, não cria nada (`null`).
 */
export async function corrigirSaldo(userId: string, data: unknown, _hojeISO = hojeSP(), chave = crypto.randomUUID()): Promise<Transacao | null> {
  usuario(userId);
  const { carteira_id, saldo_real } = corrigirSaldoSchema.parse(data);
  return carteirasRepository.rpcCorrigirSaldo(carteira_id, saldo_real, chave);
}

/** R6 "Recebi": receita "Salário" + recebimento da competência (RPC atômica). */
export async function receberRenda(userId: string, rendaId: string, data: unknown) {
  usuario(userId);
  const r = receberRendaSchema.parse(data);
  if (r.carteira_id) await carteiraAtiva(userId, r.carteira_id);
  return recebimentosRendaRepository.rpcReceber(rendaId, r.competencia, r.recebido_em, r.carteira_id);
}

export async function desfazerRecebimento(userId: string, rendaId: string, competencia: string) {
  usuario(userId);
  competenciaSchema.parse(competencia);
  return recebimentosRendaRepository.rpcDesfazer(rendaId, competencia);
}

export interface RendaAReceber {
  renda: Renda;
  competencia: string;
  /** Dia previsto no mês (sem dia cadastrado: último dia). */
  data: string;
}

/**
 * Tudo que a home precisa para "Você tem hoje", previsões, "Começou o mês com" e "Recebi".
 * Cálculo nas funções puras de `@meudia/shared`; aqui só a leitura.
 */
export async function painelSaldo(userId: string, hojeISO = hojeSP()) {
  usuario(userId);
  const competencia = competenciaDe(hojeISO);
  const alvos = alvosPrevisao(hojeISO);
  const carteiras = await carteirasRepository.findAll(userId);
  const ancoraISO = ancoraPrevisao(carteiras);
  const periodo = competenciasPrevisao(hojeISO, alvos.seteDias, ancoraISO);
  const desde = carteiras.map(dataAncora).sort()[0];
  const [transacoes, transferencias, rendas, recebimentos, contas, pagamentos] = await Promise.all([
    desde ? transacaoRepository.findComCarteiraDesde(userId, desde) : Promise.resolve([] as Transacao[]),
    desde ? transferenciasRepository.findDesde(userId, desde) : Promise.resolve([] as Transferencia[]),
    rendasRepository.findAll(userId, { ativo: true }),
    recebimentosRendaRepository.findByCompetencias(userId, periodo.rendas),
    contasPagarRepository.findAll(userId, { ativo: true }),
    pagamentosContaRepository.findByCompetencias(userId, periodo.contas),
  ]);
  const saldos = saldosCarteiras(carteiras, transacoes, transferencias, hojeISO);
  const total = saldoHoje(carteiras, transacoes, transferencias, hojeISO);
  const base = { hojeISO, saldoHoje: total, ancoraISO, rendas, recebimentos, contas, pagamentos };
  const recebidas = new Set(recebimentos.filter((r) => r.competencia === competencia).map((r) => r.renda_id));
  const rendasAReceber: RendaAReceber[] = rendas
    .filter((r) => r.ativo && !recebidas.has(r.id))
    .map((renda) => ({ renda, competencia, data: dataRendaNoMes(renda, competencia) }))
    .sort((a, b) => a.data.localeCompare(b.data));
  const ativas = new Set(saldos.map((s) => s.carteira.id));
  // "Padrão = última usada ou a primeira" (R5).
  const ultima = [...transacoes]
    .filter((t) => t.carteira_id && ativas.has(t.carteira_id) && !t.ajuste)
    .sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? ''))[0]?.carteira_id;
  return {
    hojeISO,
    competencia,
    carteiras: saldos,
    arquivadas: carteiras.filter((c) => c.arquivada),
    saldoHoje: total,
    comecouMes: comecouMesCom(carteiras, transacoes, transferencias, competencia),
    previsao7: previsao({ ...base, alvoISO: alvos.seteDias }),
    previsaoFim: previsao({ ...base, alvoISO: alvos.fimDoMes }),
    rendasAReceber,
    carteiraPadraoId: ultima ?? saldos[0]?.carteira.id ?? null,
    transacoesCarteiras: transacoes,
    transferencias,
  };
}

export type PainelSaldo = Awaited<ReturnType<typeof painelSaldo>>;

export async function criarCarteiraOnboarding(userId: string, id: string, data: unknown) {
  usuario(userId);
  return carteirasRepository.createIdempotente(userId, id, carteiraInsertSchema.parse(data));
}
