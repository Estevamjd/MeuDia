import type { ContaPagar, OcorrenciaConta, PagamentoConta } from '@meudia/shared';
import { AppError, hojeSP, ocorrenciaDaConta } from '@meudia/shared';
import { contasPagarRepository, pagamentosContaRepository } from '../repositories';
import { competenciaSchema, contaPagarInsertSchema, contaPagarUpdateSchema, pagarContaSchema } from '../validators';

function validarUsuario(userId: string) {
  if (!userId) throw new AppError('userId é obrigatório', 'VALIDATION_ERROR');
}

function derivar(conta: ContaPagar, competencia: string, pagamento: PagamentoConta | null, hojeISO: string): OcorrenciaConta | null {
  // Pagamentos preservam a visibilidade de contas desativadas no histórico.
  const ocorrencia = ocorrenciaDaConta(pagamento ? { ...conta, ativo: true } : conta, competencia);
  if (!ocorrencia && !pagamento) return null;
  // O schema não guarda o vencimento histórico. Se a recorrência foi alterada,
  // o pagamento continua visível usando a data paga como referência histórica.
  const vencimento = ocorrencia?.vencimento ?? pagamento!.pago_em;
  return {
    conta, competencia, vencimento, pagamento,
    situacao: pagamento ? 'paga' : vencimento < hojeISO ? 'vencida' : 'pendente',
  };
}

export async function listarContasDoMes(userId: string, competencia: string, hojeISO = hojeSP()): Promise<OcorrenciaConta[]> {
  validarUsuario(userId);
  competenciaSchema.parse(competencia);
  const [contas, pagamentos] = await Promise.all([
    contasPagarRepository.findAll(userId), pagamentosContaRepository.findByCompetencia(userId, competencia),
  ]);
  const porConta = new Map(pagamentos.filter(p => p.competencia === competencia).map(p => [p.conta_id, p]));
  return contas.map(conta => derivar(conta, competencia, porConta.get(conta.id) ?? null, hojeISO))
    .filter((ocorrencia): ocorrencia is OcorrenciaConta => ocorrencia !== null);
}

export async function obterContaDoMes(userId: string, id: string, competencia: string, hojeISO = hojeSP()) {
  validarUsuario(userId);
  competenciaSchema.parse(competencia);
  const [conta, historico] = await Promise.all([
    contasPagarRepository.findById(id, userId), pagamentosContaRepository.findByConta(userId, id),
  ]);
  const ocorrencia = derivar(conta, competencia, historico.find(p => p.competencia === competencia) ?? null, hojeISO);
  if (!ocorrencia) throw new AppError('Conta sem ocorrência nesta competência', 'NOT_FOUND', 404);
  return { ...ocorrencia, historico };
}

export async function criarConta(userId: string, data: unknown) {
  validarUsuario(userId);
  return contasPagarRepository.create(userId, contaPagarInsertSchema.parse(data));
}

export async function atualizarConta(userId: string, id: string, data: unknown) {
  validarUsuario(userId);
  const patch = contaPagarUpdateSchema.parse(data);
  const atual = await contasPagarRepository.findById(id, userId);
  // Valida o CHECK completo sem preencher defaults em patches parciais.
  contaPagarInsertSchema.parse({ ...atual, ...patch });
  return contasPagarRepository.update(id, patch, userId);
}

export async function desativarConta(userId: string, id: string) {
  validarUsuario(userId);
  return contasPagarRepository.update(id, { ativo: false }, userId);
}

export async function pagarConta(userId: string, id: string, data: unknown) {
  validarUsuario(userId);
  const parsed = pagarContaSchema.parse(data);
  await contasPagarRepository.findById(id, userId);
  return contasPagarRepository.rpcPagar(id, parsed.competencia, parsed.pago_em, parsed.banco);
}

export async function desfazerPagamento(userId: string, id: string, competencia: string) {
  validarUsuario(userId);
  competenciaSchema.parse(competencia);
  await contasPagarRepository.findById(id, userId);
  return contasPagarRepository.rpcDesfazer(id, competencia);
}
