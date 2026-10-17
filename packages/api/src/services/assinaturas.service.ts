import { AppError, hojeSP, diasAte, proximoVencimento as vencimento, type Assinatura } from '@meudia/shared';
import { assinaturaRepository, contasPagarRepository } from '../repositories';
import { assinaturaInsertSchema } from '../validators';

/** Prefixos de query afetados, inclusive selo/resumo e todas as competências. */
export const ASSINATURA_INVALIDACOES = [['assinaturas'], ['total-mensal'], ['contas-mes'], ['conta-mes'], ['resumo-financeiro-mes'], ['resumo-mensal'], ['carteiras']] as const;
function usuario(userId: string) {
  if (!userId) throw new AppError('userId é obrigatório', 'VALIDATION_ERROR', 400);
}
async function espelhar(userId: string, assinatura: Assinatura) {
  const input = { assinatura_id: assinatura.id, descricao: assinatura.nome, valor: Number(assinatura.valor),
    dia_vencimento: assinatura.dia_vencimento, mes_vencimento: null, data_vencimento: null,
    recorrencia: 'mensal' as const, categoria: 'Assinaturas', ativo: assinatura.ativo };
  const conta = await contasPagarRepository.findByAssinatura(assinatura.id, userId);
  if (conta) return contasPagarRepository.update(conta.id, input, userId);
  try { return await contasPagarRepository.create(userId, input); }
  catch (error) {
    // Uma edição concorrente pode ter criado o espelho; o índice único é a barreira final.
    if (!(error instanceof AppError) || error.code !== 'CONFLICT') throw error;
    const existente = await contasPagarRepository.findByAssinatura(assinatura.id, userId);
    if (!existente) throw error;
    return contasPagarRepository.update(existente.id, input, userId);
  }
}
export async function listarAssinaturas(userId: string) { usuario(userId); return assinaturaRepository.findByUserId(userId); }
export async function criarAssinatura(userId: string, data: unknown) {
  usuario(userId);
  const assinatura = await assinaturaRepository.create(userId, assinaturaInsertSchema.parse(data));
  await espelhar(userId, assinatura);
  return assinatura;
}
export async function atualizarAssinatura(userId: string, id: string, data: unknown) {
  usuario(userId);
  const assinatura = await assinaturaRepository.update(id, assinaturaInsertSchema.partial().parse(data), userId);
  await espelhar(userId, assinatura);
  return assinatura;
}
export async function excluirAssinatura(userId: string, id: string) {
  usuario(userId);
  await assinaturaRepository.findById(id, userId);
  const conta = await contasPagarRepository.findByAssinatura(id, userId);
  if (conta) await contasPagarRepository.update(conta.id, { ativo: false }, userId);
  return assinaturaRepository.remove(id, userId);
}
export async function totalMensal(userId: string) {
  return (await listarAssinaturas(userId)).reduce((sum, a) => sum + Number(a.valor), 0);
}
export async function proximoVencimento(userId: string, hojeISO = hojeSP()) {
  const assinaturas = await listarAssinaturas(userId);
  return assinaturas.reduce<Assinatura | null>((melhor, a) =>
    !melhor || diasAte(vencimento(a.dia_vencimento, hojeISO), hojeISO) < diasAte(vencimento(melhor.dia_vencimento, hojeISO), hojeISO) ? a : melhor, null);
}
