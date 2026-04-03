import { AppError } from '@meudia/shared';
import { startOfWeek, endOfWeek, startOfDay, endOfDay, format } from 'date-fns';
import { compromissoRepository } from '../repositories';
import { compromissoInsertSchema } from '../validators';

export async function listarCompromissos(userId: string) {
  if (!userId) throw new AppError('userId e obrigatorio', 'VALIDATION_ERROR');
  return compromissoRepository.findByUserId(userId);
}

export async function obterCompromisso(userId: string, compromissoId: string) {
  if (!compromissoId) throw new AppError('compromissoId e obrigatorio', 'VALIDATION_ERROR');
  return compromissoRepository.findById(compromissoId, userId);
}

export async function criarCompromisso(userId: string, data: unknown) {
  const parsed = compromissoInsertSchema.parse(data);
  return compromissoRepository.create(userId, parsed);
}

export async function atualizarCompromisso(userId: string, compromissoId: string, data: unknown) {
  const parsed = compromissoInsertSchema.partial().parse(data);
  return compromissoRepository.update(compromissoId, parsed, userId);
}

export async function excluirCompromisso(userId: string, compromissoId: string) {
  return compromissoRepository.remove(compromissoId, userId);
}

export async function compromissosHoje(userId: string) {
  const now = new Date();
  const start = startOfDay(now).toISOString();
  const end = endOfDay(now).toISOString();
  return compromissoRepository.findByDateRange(userId, start, end);
}

export async function compromissosSemana(userId: string) {
  const now = new Date();
  const start = startOfWeek(now, { weekStartsOn: 1 }).toISOString();
  const end = endOfWeek(now, { weekStartsOn: 1 }).toISOString();
  return compromissoRepository.findByDateRange(userId, start, end);
}

export async function compromissosPorData(userId: string, date: string) {
  const day = new Date(date);
  const start = startOfDay(day).toISOString();
  const end = endOfDay(day).toISOString();
  return compromissoRepository.findByDateRange(userId, start, end);
}
