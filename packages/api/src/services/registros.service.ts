import { AppError } from '@meudia/shared';
import { registrosRepository } from '../repositories';
import { registroRefeicaoInsertSchema, registroTreinoInsertSchema } from '../validators';

function usuario(userId: string) {
  if (!userId) throw new AppError('userId é obrigatório', 'VALIDATION_ERROR', 400);
}

/** Treino e Dieta rápidos (010). Escrita do app sempre com origem 'app'; o WhatsApp grava pela RPC. */
export async function listarTreinos(userId: string, desdeISO: string) {
  usuario(userId);
  return registrosRepository.listarTreinos(userId, desdeISO);
}
export async function registrarTreino(userId: string, data: unknown) {
  usuario(userId);
  return registrosRepository.criarTreino(userId, registroTreinoInsertSchema.parse(data));
}
export async function excluirTreino(userId: string, id: string) {
  usuario(userId);
  return registrosRepository.excluirTreino(id, userId);
}
export async function listarRefeicoes(userId: string, desdeISO: string) {
  usuario(userId);
  return registrosRepository.listarRefeicoes(userId, desdeISO);
}
export async function registrarRefeicao(userId: string, data: unknown) {
  usuario(userId);
  return registrosRepository.criarRefeicao(userId, registroRefeicaoInsertSchema.parse(data));
}
export async function excluirRefeicao(userId: string, id: string) {
  usuario(userId);
  return registrosRepository.excluirRefeicao(id, userId);
}
