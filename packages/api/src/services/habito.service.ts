import { AppError } from '@meudia/shared';
import type { DiaSemana } from '@meudia/shared';
import { startOfWeek, endOfWeek, format } from 'date-fns';
import { habitoRepository } from '../repositories';
import { habitoInsertSchema } from '../validators';

export async function listarHabitos(userId: string) {
  if (!userId) throw new AppError('userId é obrigatório', 'VALIDATION_ERROR');
  return habitoRepository.findByUserId(userId);
}

export async function criarHabito(userId: string, data: unknown) {
  const parsed = habitoInsertSchema.parse(data);
  return habitoRepository.create(userId, parsed);
}

export async function atualizarHabito(userId: string, habitoId: string, data: unknown) {
  const parsed = habitoInsertSchema.partial().parse(data);
  return habitoRepository.update(habitoId, parsed, userId);
}

export async function excluirHabito(userId: string, habitoId: string) {
  return habitoRepository.remove(habitoId, userId);
}

export async function obterRegistrosHoje(userId: string) {
  const today = format(new Date(), 'yyyy-MM-dd');
  return habitoRepository.findRegistrosByDate(userId, today);
}

export async function obterRegistrosSemana(userId: string) {
  const now = new Date();
  const start = format(startOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd');
  const end = format(endOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd');
  return habitoRepository.findRegistrosByDateRange(userId, start, end);
}

export async function marcarHabito(
  userId: string,
  habitoId: string,
  date: string | undefined,
  concluido: boolean,
  valor: number = 1,
) {
  const targetDate = date ?? format(new Date(), 'yyyy-MM-dd');
  return habitoRepository.upsertRegistro(userId, habitoId, targetDate, concluido, valor);
}

export async function calcularPercentualDia(userId: string) {
  const today = format(new Date(), 'yyyy-MM-dd');
  const [habitos, registros] = await Promise.all([
    habitoRepository.findByUserId(userId),
    habitoRepository.findRegistrosByDate(userId, today),
  ]);

  const diaSemana = new Date().getDay() as DiaSemana;
  const habitosHoje = habitos.filter((h) => h.dias_semana.includes(diaSemana));

  if (habitosHoje.length === 0) return { total: 0, concluidos: 0, percentual: 100 };

  const concluidos = habitosHoje.filter((h) =>
    registros.some((r) => r.habito_id === h.id && r.concluido),
  ).length;

  return {
    total: habitosHoje.length,
    concluidos,
    percentual: Math.round((concluidos / habitosHoje.length) * 100),
  };
}
