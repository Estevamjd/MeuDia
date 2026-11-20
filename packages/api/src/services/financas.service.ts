import { AppError, dividirParcelas, hojeSP, PARCELAS_MAX } from '@meudia/shared';
import type { Transacao, TransacaoInsert, UUID } from '@meudia/shared';
import { z } from 'zod';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { pagamentosContaRepository, recebimentosRendaRepository, transacaoRepository } from '../repositories';
import { findEntre as transacoesNaFaixa } from '../repositories/transacoes-faixa.repository';
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
  // Zod remove chaves desconhecidas: parcela_grupo/num/total nunca seguem no UPDATE.
  const parsed = transacaoInsertSchema.partial().parse(data);
  if ((parsed.tipo !== undefined && parsed.tipo !== 'despesa') || parsed.ajuste === true) {
    const atual = await transacaoRepository.findById(transacaoId, userId);
    if (atual.parcela_grupo) {
      throw new AppError('Só despesas sem ajuste podem ser parceladas.', 'VALIDATION_ERROR', 400);
    }
  }
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

/** Lançamentos com data entre `inicio` e `fim` (inclusive, AAAA-MM-DD), em ordem (data, id), sem truncar em max-rows. */
export async function transacoesEntre(userId: string, inicio: string, fim: string) {
  return transacoesNaFaixa(userId, inicio, fim);
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

/** Parcelado é despesa comum por mês; o grupo existe apenas para exibição/exclusão. */
export async function criarDespesaParcelada(
  userId: string, input: { base: TransacaoInsert; total: number; parcelas: number },
): Promise<Transacao[]> {
  if (!userId) throw new AppError('userId é obrigatório', 'VALIDATION_ERROR');
  if (input.base.tipo !== 'despesa' || input.base.ajuste) {
    throw new AppError('Só despesas sem ajuste podem ser parceladas.', 'VALIDATION_ERROR');
  }
  let plano: ReturnType<typeof dividirParcelas>;
  try {
    plano = dividirParcelas(input.total, input.parcelas, input.base.data ?? hojeSP());
  } catch (error) {
    throw new AppError(error instanceof Error ? error.message : 'Informe um parcelamento válido.', 'VALIDATION_ERROR', 400);
  }
  // Valida somente a base comum: o valor de cada linha vem do plano em centavos.
  const base = transacaoInsertSchema.parse({ ...input.base, valor: input.total });
  const grupo = crypto.randomUUID();
  return transacaoRepository.createMany(userId, plano.map((parcela) => ({
    ...base, ...parcela, parcela_grupo: grupo, parcela_total: input.parcelas,
  })));
}

export async function excluirParcelasDesde(userId: string, grupo: UUID, aPartirDe: number): Promise<number> {
  if (!userId || !z.string().uuid().safeParse(grupo).success || !Number.isInteger(aPartirDe) || aPartirDe < 1 || aPartirDe > PARCELAS_MAX) {
    throw new AppError('Informe o grupo e um número de parcela válido.', 'VALIDATION_ERROR', 400);
  }
  return transacaoRepository.removeParcelasDesde(userId, grupo, aPartirDe);
}
