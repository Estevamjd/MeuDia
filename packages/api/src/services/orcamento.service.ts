import { hojeSP, calcularSelo, AppError, gastoDoMes, rendaDoMes } from '@meudia/shared';
import { rendasRepository, orcamentoRepository, transacaoRepository, recebimentosRendaRepository } from '../repositories';
import { rendaInsertSchema, orcamentoInsertSchema } from '../validators';
import { listarContasDoMes } from './contas-pagar.service';
import { transacoesDoMes } from './financas.service';

function usuario(userId: string) {
  if (!userId) throw new AppError('userId é obrigatório', 'VALIDATION_ERROR', 400);
}
export async function listarRendas(userId: string) { usuario(userId); return rendasRepository.findAll(userId); }
export async function criarRenda(userId: string, data: unknown) { usuario(userId); return rendasRepository.create(userId, rendaInsertSchema.parse(data)); }
export async function atualizarRenda(userId: string, id: string, data: unknown) { usuario(userId); return rendasRepository.update(id, rendaInsertSchema.partial().parse(data), userId); }
export async function excluirRenda(userId: string, id: string) { usuario(userId); return rendasRepository.remove(id, userId); }
export async function listarOrcamento(userId: string) { usuario(userId); return orcamentoRepository.findAll(userId); }
export async function criarOrcamento(userId: string, data: unknown) { usuario(userId); return orcamentoRepository.create(userId, orcamentoInsertSchema.parse(data)); }
export async function salvarOrcamento(userId: string, data: unknown) { usuario(userId); return orcamentoRepository.upsert(userId, orcamentoInsertSchema.parse(data)); }
export async function atualizarOrcamento(userId: string, id: string, data: unknown) { usuario(userId); return orcamentoRepository.update(id, orcamentoInsertSchema.partial().parse(data), userId); }
export async function excluirOrcamento(userId: string, id: string) { usuario(userId); return orcamentoRepository.remove(id, userId); }

const dinheiro = (n: number) => Math.round(n * 100) / 100;
function delta(atual: number, anterior: number) {
  return { absoluto: dinheiro(atual - anterior), percentual: anterior === 0 ? null : (atual - anterior) / Math.abs(anterior) };
}
export async function resumoFinanceiroMes(userId: string, ano: number, mes: number, hojeISO = hojeSP()) {
  usuario(userId);
  if (!Number.isInteger(ano) || ano < 1 || ano > 9999 || !Number.isInteger(mes) || mes < 1 || mes > 12) throw new AppError('Mês inválido', 'VALIDATION_ERROR', 400);
  const comp = (a: number, m: number) => `${String(a).padStart(4, '0')}-${String(m).padStart(2, '0')}`;
  const competencia = comp(ano, mes);
  const [anoAnt, mesAnt] = mes === 1 ? [ano - 1, 12] : [ano, mes - 1];
  const competenciaAnterior = comp(anoAnt, mesAnt);
  const [rendas, orcamento, contas, transacoes, anteriores, recebimentos] = await Promise.all([
    rendasRepository.findAll(userId, { ativo: true }), orcamentoRepository.findAll(userId),
    listarContasDoMes(userId, competencia, hojeISO), transacoesDoMes(userId, ano, mes),
    transacoesDoMes(userId, anoAnt, mesAnt),
    recebimentosRendaRepository.findByCompetencias(userId, [competencia, competenciaAnterior]),
  ]);
  const rendaPrevista = dinheiro(rendas.filter(r => r.ativo).reduce((s, r) => s + Number(r.valor), 0));
  // R11: renda do mês = receitas lançadas (sem ajuste) + rendas fixas sem "Recebi" na competência.
  // Receita avulsa soma por cima da renda prevista, nunca a substitui. Ajustes ficam fora de renda e gasto.
  const totais = (rows: typeof transacoes, c: string) => {
    const renda = rendaDoMes(c, rows, rendas, recebimentos);
    return { renda: renda.lancada, rendaDoMes: renda.total, gasto: gastoDoMes(rows) };
  };
  const atual = totais(transacoes, competencia), anterior = totais(anteriores, competenciaAnterior);
  const faltantes = contas.flatMap(c => c.pagamento?.transacao_id && !transacoes.some(t => t.id === c.pagamento!.transacao_id) ? [c.pagamento.transacao_id] : []);
  const historicas = faltantes.length ? await transacaoRepository.findByIds(userId, faltantes) : [];
  const porId = new Map([...transacoes, ...historicas].map(t => [t.id, t]));
  // Para pagas, a transação preserva categoria/valor da época quando disponível.
  const categorias = new Map<string, number>();
  for (const c of contas) {
    const historica = c.pagamento?.transacao_id ? porId.get(c.pagamento.transacao_id) : undefined;
    const categoria = historica?.categoria ?? c.conta.categoria;
    categorias.set(categoria, (categorias.get(categoria) ?? 0) + Number(historica?.valor ?? c.conta.valor));
  }
  const contasMes = dinheiro([...categorias.values()].reduce((s, v) => s + v, 0));
  for (const o of orcamento) categorias.set(o.categoria, Math.max(categorias.get(o.categoria) ?? 0, Number(o.valor_planejado)));
  const gastoPrevisto = dinheiro([...categorias.values()].reduce((s, v) => s + v, 0));
  const sobraPrevista = dinheiro(rendaPrevista - gastoPrevisto);
  const sobraReal = dinheiro(atual.rendaDoMes - atual.gasto);
  const sobraAnterior = dinheiro(anterior.rendaDoMes - anterior.gasto);
  const pctComprometida = rendaPrevista === 0 ? null : contasMes / rendaPrevista;
  const vencidas = contas.filter(c => c.vencimento <= hojeISO);
  const pagas = vencidas.filter(c => c.pagamento && c.pagamento.pago_em <= c.vencimento).length;
  return {
    rendaPrevista, rendaReal: atual.renda, rendaDoMes: atual.rendaDoMes, gastoReal: atual.gasto, contasMes, gastoPrevisto, sobraPrevista, sobraReal, pctComprometida,
    pagasNoPrazo: vencidas.length === 0 ? null : pagas / vencidas.length,
    vsMesAnterior: { gastoReal: delta(atual.gasto, anterior.gasto), sobraReal: delta(sobraReal, sobraAnterior) },
    selo: calcularSelo({ rendaPrevista, contasMes, sobraPrevista, pctComprometida, temContaVencida: contas.some(c => c.situacao === 'vencida') }),
  };
}
