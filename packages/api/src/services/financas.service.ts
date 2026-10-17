import { AppError } from '@meudia/shared';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { pagamentosContaRepository, recebimentosRendaRepository, transacaoRepository } from '../repositories';
import { transacaoInsertSchema } from '../validators';

export async function listarTransacoes(userId: string) {
  if (!userId) throw new AppError('userId é obrigatório', 'VALIDATION_ERROR');
  return transacaoRepository.findByUserId(userId);
}

export async function criarTransacao(userId: string, data: unknown) {
  const parsed = transacaoInsertSchema.parse(data);
  return transacaoRepository.create(userId, parsed);
}

export async function atualizarTransacao(userId: string, transacaoId: string, data: unknown) {
  await impedirAlteracaoVinculada(userId, transacaoId);
  const parsed = transacaoInsertSchema.partial().parse(data);
  return transacaoRepository.update(transacaoId, parsed, userId);
}

export async function excluirTransacao(userId: string, transacaoId: string) {
  await impedirAlteracaoVinculada(userId, transacaoId);
  return transacaoRepository.remove(transacaoId, userId);
}

export async function transacoesDoMes(userId: string, ano: number, mes: number) {
  const ref = new Date(ano, mes - 1, 1);
  const start = format(startOfMonth(ref), 'yyyy-MM-dd');
  const end = format(endOfMonth(ref), 'yyyy-MM-dd');
  return transacaoRepository.findByDateRange(userId, start, end);
}

export async function resumoMensal(userId: string, ano: number, mes: number) {
  const transacoes = await transacoesDoMes(userId, ano, mes);

  let totalReceitas = 0;
  let totalDespesas = 0;

  for (const t of transacoes) {
    if (t.ajuste) continue;
    if (t.tipo === 'receita') {
      totalReceitas += Number(t.valor);
    } else {
      totalDespesas += Number(t.valor);
    }
  }

  return {
    totalReceitas,
    totalDespesas,
    saldo: totalReceitas - totalDespesas,
  };
}

export async function vinculosTransacoes(userId: string, ids: string[]) {
  const [recebimentos, pagamentos] = await Promise.all([
    recebimentosRendaRepository.findByTransacoes(userId, ids),
    pagamentosContaRepository.findByTransacoes(userId, ids),
  ]);
  return { recebimentos, pagamentos };
}

async function impedirAlteracaoVinculada(userId: string, id: string) {
  const { recebimentos, pagamentos } = await vinculosTransacoes(userId, [id]);
  if (recebimentos.length) throw new AppError('Use Desfazer recebimento para alterar este lançamento.', 'TRANSACAO_VINCULADA', 409);
  if (pagamentos.length) throw new AppError('Use Desfazer pagamento para alterar este lançamento.', 'TRANSACAO_VINCULADA', 409);
}
