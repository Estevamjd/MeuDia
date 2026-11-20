import { usuarioAtualId } from './usuario-atual';
import { AppError, hojeSP } from '@meudia/shared';
import { dietaRepository } from '../repositories';
import { refeicaoInsertSchema, registroPesoInsertSchema } from '../validators';

// ── Refeições ──

export async function refeicoesDoDia(userId: string, date?: string) {
  if (!userId) throw new AppError('userId é obrigatório', 'VALIDATION_ERROR');
  const targetDate = date ?? hojeSP();
  return dietaRepository.findRefeicoesByDate(userId, targetDate);
}

export async function criarRefeicao(userId: string, data: unknown) {
  const parsed = refeicaoInsertSchema.parse(data);
  return dietaRepository.createRefeicao(userId, parsed);
}

export async function atualizarRefeicao(refeicaoId: string, data: unknown) {
  const parsed = refeicaoInsertSchema.partial().parse(data);
  return dietaRepository.updateRefeicao(refeicaoId, parsed, await usuarioAtualId());
}

export async function excluirRefeicao(refeicaoId: string) {
  return dietaRepository.removeRefeicao(refeicaoId, await usuarioAtualId());
}

// ── Peso ──

/** Registros desde `desde` ('AAAA-MM-DD'), em ordem de data. */
export async function pesoDesde(userId: string, desde: string) {
  if (!userId) throw new AppError('userId é obrigatório', 'VALIDATION_ERROR');
  return dietaRepository.findRegistrosPesoDesde(userId, desde);
}

/** Grava ou corrige o peso de um dia (um registro por dia). */
export async function registrarPesoDoDia(userId: string, data: unknown) {
  if (!userId) throw new AppError('userId é obrigatório', 'VALIDATION_ERROR');
  const parsed = registroPesoInsertSchema.parse(data);
  return dietaRepository.upsertRegistroPeso(userId, { ...parsed, data: parsed.data ?? hojeSP() });
}
