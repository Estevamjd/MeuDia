import { AppError } from '@meudia/shared';
import { cofrinhoRepository } from '../repositories';
import { corrigirCofrinhoSchema, fecharMesSchema, moverCofrinhoSchema } from '../validators';

function usuario(userId: string) {
  if (!userId) throw new AppError('userId é obrigatório', 'VALIDATION_ERROR', 400);
}

/** "Guardar no Cofrinho" / "Tirar do Cofrinho". `chave` torna o toque idempotente (repetir não soma de novo). */
export async function moverCofrinho(userId: string, data: unknown, chave: string = crypto.randomUUID()) {
  usuario(userId);
  const { tipo, valor } = moverCofrinhoSchema.parse(data);
  return cofrinhoRepository.rpcMover(tipo, valor, chave);
}

/** "Corrigir": o Cofrinho passa a valer exatamente `valor_real` (lança só a diferença). */
export async function corrigirCofrinho(userId: string, data: unknown, chave: string = crypto.randomUUID()) {
  usuario(userId);
  const { valor_real } = corrigirCofrinhoSchema.parse(data);
  return cofrinhoRepository.rpcCorrigir(valor_real, chave);
}

/** Resposta ao fechamento do mês (uma vez por mês; repetir devolve a resposta já gravada). */
export async function fecharMesCofrinho(userId: string, data: unknown) {
  usuario(userId);
  const f = fecharMesSchema.parse(data);
  return cofrinhoRepository.rpcFecharMes(f.competencia, f.guardar, f.guardar ? f.valor : null);
}
