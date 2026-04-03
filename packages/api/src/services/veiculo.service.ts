import { AppError } from '@meudia/shared';
import { veiculoRepository } from '../repositories';
import { veiculoInsertSchema, manutencaoInsertSchema } from '../validators';

export async function listarVeiculos(userId: string) {
  if (!userId) throw new AppError('userId é obrigatório', 'VALIDATION_ERROR');
  return veiculoRepository.findByUserId(userId);
}

export async function criarVeiculo(userId: string, data: unknown) {
  const parsed = veiculoInsertSchema.parse(data);
  return veiculoRepository.create(userId, parsed);
}

export async function atualizarVeiculo(veiculoId: string, data: unknown) {
  const parsed = veiculoInsertSchema.partial().parse(data);
  return veiculoRepository.update(veiculoId, parsed);
}

export async function excluirVeiculo(veiculoId: string) {
  return veiculoRepository.remove(veiculoId);
}

export async function listarManutencoes(veiculoId: string) {
  if (!veiculoId) throw new AppError('veiculoId é obrigatório', 'VALIDATION_ERROR');
  return veiculoRepository.findManutencoesByVeiculoId(veiculoId);
}

export async function criarManutencao(data: unknown) {
  const parsed = manutencaoInsertSchema.parse(data);
  return veiculoRepository.createManutencao(parsed);
}

export async function excluirManutencao(manutencaoId: string) {
  return veiculoRepository.removeManutencao(manutencaoId);
}

export async function proximasRevisoes(userId: string) {
  const veiculos = await veiculoRepository.findByUserId(userId);
  const alertas: { veiculoId: string; modelo: string; kmAtual: number; proximaRevisaoKm: number; kmRestantes: number }[] = [];

  for (const veiculo of veiculos) {
    const manutencoes = await veiculoRepository.findManutencoesByVeiculoId(veiculo.id);
    for (const m of manutencoes) {
      if (m.proxima_revisao_km && veiculo.km_atual) {
        const kmRestantes = m.proxima_revisao_km - veiculo.km_atual;
        if (kmRestantes > 0 && kmRestantes <= 1000) {
          alertas.push({
            veiculoId: veiculo.id,
            modelo: veiculo.modelo,
            kmAtual: veiculo.km_atual,
            proximaRevisaoKm: m.proxima_revisao_km,
            kmRestantes,
          });
        }
      }
    }
  }

  return alertas;
}

export async function totalGastosManutencao(veiculoId: string) {
  const manutencoes = await veiculoRepository.findManutencoesByVeiculoId(veiculoId);
  let total = 0;
  for (const m of manutencoes) {
    if (m.custo) {
      total += Number(m.custo);
    }
  }
  return total;
}
