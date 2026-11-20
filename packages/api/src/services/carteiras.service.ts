import type { Carteira, Renda, Transacao, Transferencia } from '@meudia/shared';
import {
  AppError,
  CATEGORIA_ENTRADA_EXTRA,
  competenciaAnterior,
  competenciaDe,
  comecouMesCom,
  dataAncora,
  dataRendaNoMes,
  fimDoMes,
  hojeSP,
  saldoCarteira,
  somarDias,
  painelDeSaldosAgregados,
  saldoHoje,
  saldosCarteiras,
  saldoCofrinho,
  sobraDoMes,
} from '@meudia/shared';
import {
  carteirasRepository,
  cofrinhoRepository,
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

/** Arquivar: sai do total e dos seletores; o histórico fica. */
export async function arquivarCarteira(userId: string, id: string, arquivada = true) {
  usuario(userId);
  return carteirasRepository.update(id, { arquivada }, userId);
}

/**
 * Excluir banco (007): lançamentos e rendas dele viram "Sem banco"; transferências perdem este lado e continuam
 * contando no outro banco (o saldo dos demais não muda); transferência sem nenhum dos dois lados some.
 */
export async function excluirCarteira(userId: string, id: string) {
  usuario(userId);
  return carteirasRepository.remove(id, userId);
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

/** Cofrinho do usuário: congela o ponto de partida no primeiro acesso com banco (usuário novo depois da 014). */
async function lerCofrinho(userId: string, temCarteira: boolean) {
  let dados = await cofrinhoRepository.carregar(userId);
  if (dados && temCarteira && !dados.movimentos.some((m) => m.tipo === 'inicial')) {
    await cofrinhoRepository.rpcIniciar();
    dados = await cofrinhoRepository.carregar(userId);
  }
  if (!dados) return null;
  return {
    saldo: saldoCofrinho(dados.movimentos),
    inicioEm: dados.movimentos.find((m) => m.tipo === 'inicial')?.created_at ?? null,
    respondidas: dados.fechamentos.map((f) => f.competencia),
    movimentos: dados.movimentos,
  };
}

/**
 * Tudo que a home precisa: bancos, Cofrinho (014), "Recebi" e as entradas da sobra do mês (`sobraDoMes`, calculada
 * na home com os lançamentos do mês que ela já lê) + a sobra do mês anterior (fechamento do mês).
 * Cálculo nas funções puras de `@meudia/shared`; aqui só a leitura.
 */
export async function painelSaldo(userId: string, hojeISO = hojeSP()) {
  usuario(userId);
  const competencia = competenciaDe(hojeISO);
  const anterior = competenciaAnterior(competencia);
  const agregado = await carteirasRepository.rpcResumoPainelSaldo(hojeISO);
  const carteiras = agregado ? agregado.carteiras.map(({ saldo: _saldo, saldo_fim_mes_anterior: _anterior, ...c }) => c) : await carteirasRepository.findAll(userId);
  const desde = agregado ? undefined : carteiras.map(dataAncora).sort()[0];
  const [transacoes, transferencias, rendas, recebimentos, contas, pagamentos, doisMeses, cofrinho] = await Promise.all([
    desde ? transacaoRepository.findComCarteiraDesde(userId, desde) : Promise.resolve([] as Transacao[]),
    desde ? transferenciasRepository.findDesde(userId, desde) : Promise.resolve([] as Transferencia[]),
    rendasRepository.findAll(userId, { ativo: true }),
    recebimentosRendaRepository.findByCompetencias(userId, [anterior, competencia]),
    contasPagarRepository.findAll(userId, { ativo: true }),
    pagamentosContaRepository.findByCompetencias(userId, [anterior, competencia]),
    transacaoRepository.findByDateRange(userId, `${anterior}-01`, fimDoMes(competencia)),
    lerCofrinho(userId, carteiras.length > 0),
  ]);
  // Lançamentos que são "Paguei" de alguma conta: entram só como a conta, nunca como gasto extra.
  const despesas = doisMeses.filter((t) => t.tipo === 'despesa' && !t.ajuste).map((t) => t.id);
  const vinculos = despesas.length ? await pagamentosContaRepository.findByTransacoes(userId, despesas) : [];
  const porId = new Map(doisMeses.map((t) => [t.id, t]));
  const foraDaJanela = pagamentos.flatMap((p) => (p.transacao_id && !porId.has(p.transacao_id) ? [p.transacao_id] : []));
  const pagasFora = foraDaJanela.length ? await transacaoRepository.findByIds(userId, foraDaJanela) : [];
  const transacoesDeContas: Record<string, number> = {};
  for (const id of [...vinculos.map((v) => v.transacao_id), ...pagamentos.map((p) => p.transacao_id)]) {
    const t = id ? porId.get(id) ?? pagasFora.find((x) => x.id === id) : undefined;
    if (t) transacoesDeContas[t.id] = Number(t.valor);
  }
  const doMes = (c: string) => <T extends { competencia: string }>(xs: T[]) => xs.filter((x) => x.competencia === c);
  const recebimentosMes = doMes(competencia)(recebimentos);
  const pagamentosMes = doMes(competencia)(pagamentos);
  const sobraAnterior = sobraDoMes({
    competencia: anterior, transacoes: doisMeses, rendas, contas, transacoesDeContas,
    recebimentos: doMes(anterior)(recebimentos), pagamentos: doMes(anterior)(pagamentos),
  });
  const saldos = agregado ? [] : saldosCarteiras(carteiras, transacoes, transferencias, hojeISO);
  const recebidas = new Set(recebimentosMes.map((r) => r.renda_id));
  const rendasAReceber: RendaAReceber[] = rendas
    .filter((r) => r.ativo && !recebidas.has(r.id))
    .map((renda) => ({ renda, competencia, data: dataRendaNoMes(renda, competencia) }))
    .sort((a, b) => a.data.localeCompare(b.data));
  const ativas = new Set(saldos.map((s) => s.carteira.id));
  // "Padrão = última usada ou a primeira" (R5).
  const ultima = [...transacoes]
    .filter((t) => t.carteira_id && ativas.has(t.carteira_id) && !t.ajuste)
    .sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? '') || a.data.localeCompare(b.data) || a.id.localeCompare(b.id))[0]?.carteira_id;
  return {
    hojeISO,
    competencia,
    carteiras: saldos,
    arquivadas: carteiras.filter((c) => c.arquivada),
    /** Total nos bancos ativos "no total" hoje (não é mais o Cofrinho). */
    saldoHoje: saldoHoje(carteiras, transacoes, transferencias, hojeISO),
    comecouMes: comecouMesCom(carteiras, transacoes, transferencias, competencia),
    rendasAReceber,
    /** Entradas de `sobraDoMes` na competência corrente. */
    mes: { rendas, recebimentos: recebimentosMes, contas, pagamentos: pagamentosMes, transacoesDeContas },
    /** "Deve sobrar" do mês anterior (pergunta do fechamento). */
    mesAnterior: { competencia: anterior, sobra: sobraAnterior.valor },
    /** `null`: banco sem a 014 (a tela mostra o total dos bancos como antes). */
    cofrinho,
    carteiraPadraoId: ultima ?? saldos[0]?.carteira.id ?? null,
    ...(agregado ? painelDeSaldosAgregados(agregado.carteiras, competencia, agregado.ultimaCarteiraId) : {}),
  };
}

export type PainelSaldo = Awaited<ReturnType<typeof painelSaldo>>;

export async function criarCarteiraOnboarding(userId: string, id: string, data: unknown) {
  usuario(userId);
  return carteirasRepository.createIdempotente(userId, id, carteiraInsertSchema.parse(data));
}

/** Lista independente do painel: paginação por chave até esgotar. */
export async function transferenciasRecentes(userId: string) {
  usuario(userId);
  return transferenciasRepository.findAll(userId);
}

export async function historicoSaldoMes(userId: string, competencia: string) {
  usuario(userId);
  competenciaSchema.parse(competencia);
  const fimAnterior = somarDias(`${competencia}-01`, -1);
  const [agregado, transferencias] = await Promise.all([
    carteirasRepository.rpcSaldosCarteirasEm(fimAnterior),
    transferenciasRepository.findEntre(userId, `${competencia}-01`, fimDoMes(competencia)),
  ]);
  if (agregado) return { bases: agregado, transferencias };
  const carteiras = await carteirasRepository.findAll(userId);
  const desde = carteiras.map(dataAncora).sort()[0];
  const [ts, trs] = desde ? await Promise.all([
    transacaoRepository.findComCarteiraDesde(userId, desde), transferenciasRepository.findDesde(userId, desde),
  ]) : [[], []];
  return { bases: Object.fromEntries(carteiras.map((c) => [c.id, saldoCarteira(c, ts, trs, fimAnterior)])), transferencias };
}

export type HistoricoSaldoMes = Awaited<ReturnType<typeof historicoSaldoMes>>;
