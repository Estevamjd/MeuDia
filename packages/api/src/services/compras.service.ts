import { AppError } from '@meudia/shared';
import { comprasRepository } from '../repositories';
import { listaInsertSchema, itemInsertSchema } from '../validators';

/* ── Listas ── */

export async function listarListas(userId: string) {
  if (!userId) throw new AppError('userId é obrigatório', 'VALIDATION_ERROR');
  return comprasRepository.findListasByUserId(userId);
}

export async function criarLista(userId: string, data: unknown) {
  const parsed = listaInsertSchema.parse(data);
  return comprasRepository.createLista(userId, parsed);
}

export async function atualizarLista(listaId: string, data: unknown) {
  const parsed = listaInsertSchema.partial().parse(data);
  return comprasRepository.updateLista(listaId, parsed);
}

export async function excluirLista(listaId: string) {
  return comprasRepository.removeLista(listaId);
}

/* ── Itens ── */

export async function obterItens(listaId: string) {
  return comprasRepository.findItensByListaId(listaId);
}

export async function adicionarItem(data: unknown) {
  const parsed = itemInsertSchema.parse(data);
  return comprasRepository.createItem(parsed);
}

export async function atualizarItem(itemId: string, data: unknown) {
  const parsed = itemInsertSchema.partial().parse(data);
  return comprasRepository.updateItem(itemId, parsed);
}

export async function excluirItem(itemId: string) {
  return comprasRepository.removeItem(itemId);
}

export async function toggleItem(itemId: string, comprado: boolean) {
  return comprasRepository.toggleComprado(itemId, comprado);
}

/* ── Resumo ── */

export async function resumoLista(listaId: string) {
  const itens = await comprasRepository.findItensByListaId(listaId);
  const total = itens.length;
  const comprados = itens.filter((i) => i.comprado).length;
  const custoEstimado = itens.reduce((acc, i) => {
    if (i.preco_estimado != null) {
      return acc + i.preco_estimado * i.quantidade;
    }
    return acc;
  }, 0);

  return { total, comprados, custoEstimado };
}
