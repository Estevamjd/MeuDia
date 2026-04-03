import { AppError } from '@meudia/shared';
import { format, startOfDay, endOfDay } from 'date-fns';
import { medicamentoRepository } from '../repositories';
import { medicamentoInsertSchema } from '../validators';

export async function listarMedicamentos(userId: string) {
  if (!userId) throw new AppError('userId é obrigatório', 'VALIDATION_ERROR');
  return medicamentoRepository.findByUserId(userId);
}

export async function criarMedicamento(userId: string, data: unknown) {
  const parsed = medicamentoInsertSchema.parse(data);
  return medicamentoRepository.create(userId, parsed);
}

export async function atualizarMedicamento(medicamentoId: string, data: unknown) {
  const parsed = medicamentoInsertSchema.partial().parse(data);
  return medicamentoRepository.update(medicamentoId, parsed);
}

export async function excluirMedicamento(medicamentoId: string) {
  return medicamentoRepository.remove(medicamentoId);
}

export async function registrarTomado(userId: string, medicamentoId: string) {
  const registro = await medicamentoRepository.createRegistro(userId, {
    medicamento_id: medicamentoId,
    tomado: true,
  });

  // Decrement estoque
  const medicamento = await medicamentoRepository.findById(medicamentoId);
  if (medicamento.estoque_atual > 0) {
    await medicamentoRepository.update(medicamentoId, {
      estoque_atual: medicamento.estoque_atual - 1,
    });
  }

  return registro;
}

export async function medicamentosHoje(userId: string) {
  const hoje = new Date();
  const inicio = startOfDay(hoje).toISOString();
  const fim = endOfDay(hoje).toISOString();

  const [medicamentos, registros] = await Promise.all([
    medicamentoRepository.findByUserId(userId),
    medicamentoRepository.findRegistrosByDate(userId, inicio, fim),
  ]);

  const registrosMap = new Map<string, boolean>();
  for (const r of registros) {
    if (r.tomado) {
      registrosMap.set(r.medicamento_id, true);
    }
  }

  return medicamentos.map((med) => ({
    ...med,
    tomadoHoje: registrosMap.has(med.id),
  }));
}

export async function verificarEstoqueBaixo(userId: string) {
  const medicamentos = await medicamentoRepository.findByUserId(userId);
  return medicamentos.filter((med) => med.estoque_atual <= med.estoque_minimo);
}
