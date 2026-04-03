import { AppError } from '@meudia/shared';
import { assinaturaRepository } from '../repositories';
import { assinaturaInsertSchema } from '../validators';

export async function listarAssinaturas(userId: string) {
  if (!userId) throw new AppError('userId é obrigatório', 'VALIDATION_ERROR');
  return assinaturaRepository.findByUserId(userId);
}

export async function criarAssinatura(userId: string, data: unknown) {
  const parsed = assinaturaInsertSchema.parse(data);
  return assinaturaRepository.create(userId, parsed);
}

export async function atualizarAssinatura(assinaturaId: string, data: unknown) {
  const parsed = assinaturaInsertSchema.partial().parse(data);
  return assinaturaRepository.update(assinaturaId, parsed);
}

export async function excluirAssinatura(assinaturaId: string) {
  return assinaturaRepository.remove(assinaturaId);
}

export async function totalMensal(userId: string) {
  const assinaturas = await assinaturaRepository.findByUserId(userId);
  return assinaturas.reduce((sum, a) => sum + Number(a.valor), 0);
}

export async function proximoVencimento(userId: string) {
  const assinaturas = await assinaturaRepository.findByUserId(userId);
  if (assinaturas.length === 0) return null;

  const hoje = new Date();
  const diaAtual = hoje.getDate();
  const mesAtual = hoje.getMonth();
  const anoAtual = hoje.getFullYear();

  let maisProxima = assinaturas[0]!;
  let menorDiff = Infinity;

  for (const a of assinaturas) {
    let proximaData: Date;
    if (a.dia_vencimento >= diaAtual) {
      proximaData = new Date(anoAtual, mesAtual, a.dia_vencimento);
    } else {
      proximaData = new Date(anoAtual, mesAtual + 1, a.dia_vencimento);
    }

    const diff = proximaData.getTime() - hoje.getTime();
    if (diff >= 0 && diff < menorDiff) {
      menorDiff = diff;
      maisProxima = a;
    }
  }

  return maisProxima;
}
