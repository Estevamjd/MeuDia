import { AppError } from '@meudia/shared';
import { format } from 'date-fns';
import { dietaRepository } from '../repositories';
import { refeicaoInsertSchema, registroPesoInsertSchema, registroAguaSchema } from '../validators';

// ── Refeições ──

export async function refeicoesDoDia(userId: string, date?: string) {
  if (!userId) throw new AppError('userId é obrigatório', 'VALIDATION_ERROR');
  const targetDate = date ?? format(new Date(), 'yyyy-MM-dd');
  return dietaRepository.findRefeicoesByDate(userId, targetDate);
}

export async function criarRefeicao(userId: string, data: unknown) {
  const parsed = refeicaoInsertSchema.parse(data);
  return dietaRepository.createRefeicao(userId, parsed);
}

export async function atualizarRefeicao(refeicaoId: string, data: unknown) {
  const parsed = refeicaoInsertSchema.partial().parse(data);
  return dietaRepository.updateRefeicao(refeicaoId, parsed);
}

export async function excluirRefeicao(refeicaoId: string) {
  return dietaRepository.removeRefeicao(refeicaoId);
}

// ── Água ──

export async function aguaHoje(userId: string, date?: string) {
  if (!userId) throw new AppError('userId é obrigatório', 'VALIDATION_ERROR');
  const targetDate = date ?? format(new Date(), 'yyyy-MM-dd');
  return dietaRepository.findRegistroAguaByDate(userId, targetDate);
}

export async function registrarAgua(userId: string, date?: string) {
  if (!userId) throw new AppError('userId é obrigatório', 'VALIDATION_ERROR');
  const targetDate = date ?? format(new Date(), 'yyyy-MM-dd');

  const atual = await dietaRepository.findRegistroAguaByDate(userId, targetDate);
  const coposAtual = atual?.copos_bebidos ?? 0;
  const metaCopos = atual?.meta_copos ?? 8;

  return dietaRepository.upsertRegistroAgua(userId, {
    data: targetDate,
    copos_bebidos: coposAtual + 1,
    meta_copos: metaCopos,
  });
}

// ── Peso ──

export async function historicosPeso(userId: string, limit?: number) {
  if (!userId) throw new AppError('userId é obrigatório', 'VALIDATION_ERROR');
  return dietaRepository.findRegistrosPeso(userId, limit);
}

export async function registrarPeso(userId: string, data: unknown) {
  const parsed = registroPesoInsertSchema.parse(data);
  return dietaRepository.createRegistroPeso(userId, parsed);
}

// ── Resumo Nutricional ──

export async function resumoNutricionalDia(userId: string, date?: string) {
  if (!userId) throw new AppError('userId é obrigatório', 'VALIDATION_ERROR');
  const targetDate = date ?? format(new Date(), 'yyyy-MM-dd');
  const refeicoes = await dietaRepository.findRefeicoesByDate(userId, targetDate);

  return refeicoes.reduce(
    (acc, ref) => ({
      calorias: acc.calorias + (ref.total_calorias ?? 0),
      proteina: acc.proteina + (ref.total_proteina ?? 0),
      carbo: acc.carbo + (ref.total_carbo ?? 0),
      gordura: acc.gordura + (ref.total_gordura ?? 0),
    }),
    { calorias: 0, proteina: 0, carbo: 0, gordura: 0 },
  );
}
