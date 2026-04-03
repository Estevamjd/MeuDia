import { SupabaseClient } from '@supabase/supabase-js';
import { createNotaRepository, NotaInsert, NotaUpdate } from '../repositories/nota.repository';
import { notaInsertSchema, notaUpdateSchema } from '../validators/nota.validator';

export function createNotasService(supabase: SupabaseClient) {
  const repo = createNotaRepository(supabase);

  return {
    listar: (userId: string) => repo.listar(userId),
    buscarPorId: (id: string, userId: string) => repo.buscarPorId(id, userId),
    criar: (nota: NotaInsert) => {
      const { user_id, ...rest } = nota;
      notaInsertSchema.parse(rest);
      return repo.criar(nota);
    },
    atualizar: (id: string, updates: NotaUpdate, userId: string) => {
      notaUpdateSchema.parse(updates);
      return repo.atualizar(id, updates, userId);
    },
    excluir: (id: string, userId: string) => repo.excluir(id, userId),
  };
}
