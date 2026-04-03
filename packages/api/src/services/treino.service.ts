import { AppError } from '@meudia/shared';
import { startOfWeek, endOfWeek, format } from 'date-fns';
import { treinoRepository, exercicioRepository, sessaoRepository } from '../repositories';
import { treinoInsertSchema, exercicioInsertSchema, serieRealizadaSchema, sessaoInsertSchema } from '../validators';

export async function listarTreinos(userId: string) {
  if (!userId) throw new AppError('userId é obrigatório', 'VALIDATION_ERROR');
  return treinoRepository.findByUserId(userId);
}

export async function obterTreino(userId: string, treinoId: string) {
  return treinoRepository.findById(treinoId, userId);
}

export async function criarTreino(userId: string, data: unknown) {
  const parsed = treinoInsertSchema.parse(data);
  return treinoRepository.create(userId, parsed);
}

export async function atualizarTreino(userId: string, treinoId: string, data: unknown) {
  const parsed = treinoInsertSchema.partial().parse(data);
  return treinoRepository.update(treinoId, parsed, userId);
}

export async function excluirTreino(userId: string, treinoId: string) {
  return treinoRepository.remove(treinoId, userId);
}

export async function adicionarExercicio(data: unknown) {
  const parsed = exercicioInsertSchema.parse(data);
  return exercicioRepository.create(parsed);
}

export async function atualizarExercicio(exercicioId: string, data: unknown) {
  const parsed = exercicioInsertSchema.partial().parse(data);
  return exercicioRepository.update(exercicioId, parsed);
}

export async function excluirExercicio(exercicioId: string) {
  return exercicioRepository.remove(exercicioId);
}

export async function reordenarExercicios(exercicios: { id: string; ordem: number }[]) {
  return exercicioRepository.updateOrdem(exercicios);
}

export async function iniciarSessao(userId: string, treinoId: string | null) {
  const today = format(new Date(), 'yyyy-MM-dd');
  return sessaoRepository.create(userId, {
    treino_id: treinoId,
    data: today,
    concluido: false,
  });
}

export async function finalizarSessao(sessaoId: string, duracao: number) {
  return sessaoRepository.update(sessaoId, {
    concluido: true,
    duracao_minutos: duracao,
  });
}

export async function registrarSerie(data: unknown) {
  const parsed = serieRealizadaSchema.parse(data);
  return sessaoRepository.createSeriesRealizadas([parsed]);
}

export async function obterSessoesSemana(userId: string) {
  const now = new Date();
  const start = format(startOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd');
  const end = format(endOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd');
  return sessaoRepository.findByUserAndDateRange(userId, start, end);
}

export async function obterSeriesDaSessao(sessaoId: string) {
  return sessaoRepository.findSeriesBySessao(sessaoId);
}

export async function atualizarSerie(serieId: string, data: unknown) {
  const parsed = serieRealizadaSchema.partial().parse(data);
  return sessaoRepository.updateSerie(serieId, parsed);
}

/**
 * Obtém o histórico de séries realizadas de um exercício.
 * Usado pelo agente para análise de progressão de carga.
 */
export async function obterHistoricoExercicio(exercicioId: string, limit = 20) {
  return sessaoRepository.findSeriesByExercicioId(exercicioId, limit);
}
