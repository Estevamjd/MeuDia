import { AppError } from '@meudia/shared';
import { metasRepository } from '../repositories';
import { metaInsertSchema, metaUpdateSchema, valorGuardadoSchema } from '../validators';

function usuario(userId: string) {
  if (!userId) throw new AppError('userId é obrigatório', 'VALIDATION_ERROR', 400);
}

/** Metas de compra (007). A sugestão de quanto guardar é calculada no app (`sugestaoMeta`, @meudia/shared). */
export async function listarMetas(userId: string) {
  usuario(userId);
  return metasRepository.findAll(userId);
}

export async function criarMeta(userId: string, data: unknown) {
  usuario(userId);
  return metasRepository.create(userId, metaInsertSchema.parse(data));
}

/** Editar ou corrigir o valor guardado (absoluto, ≥ 0). */
export async function atualizarMeta(userId: string, id: string, data: unknown) {
  usuario(userId);
  return metasRepository.update(id, metaUpdateSchema.parse(data), userId);
}

/** "Guardei": soma `valor` ao guardado (RPC atômica). */
export async function guardar(userId: string, id: string, valor: unknown) {
  usuario(userId);
  return metasRepository.rpcGuardar(id, valorGuardadoSchema.parse(valor));
}

export async function excluirMeta(userId: string, id: string) {
  usuario(userId);
  return metasRepository.remove(id, userId);
}
