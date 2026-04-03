import { SupabaseClient } from '@supabase/supabase-js';

export interface Nota {
  id: string;
  user_id: string;
  titulo: string;
  conteudo: string;
  tags: string[];
  cor: string;
  fixada: boolean;
  checklist: { id: string; text: string; checked: boolean }[];
  lembrete: string | null;
  created_at: string;
  updated_at: string;
}

export type NotaInsert = Omit<Nota, 'id' | 'created_at' | 'updated_at'>;
export type NotaUpdate = Partial<Omit<Nota, 'id' | 'user_id' | 'created_at'>>;

export function createNotaRepository(supabase: SupabaseClient) {
  return {
    async listar(userId: string) {
      const { data, error } = await supabase
        .from('notas')
        .select('*')
        .eq('user_id', userId)
        .order('fixada', { ascending: false })
        .order('updated_at', { ascending: false });
      if (error) throw error;
      return data as Nota[];
    },

    async buscarPorId(id: string, userId: string) {
      const { data, error } = await supabase
        .from('notas')
        .select('*')
        .eq('id', id)
        .eq('user_id', userId)
        .single();
      if (error) throw error;
      return data as Nota;
    },

    async criar(nota: NotaInsert) {
      const { data, error } = await supabase
        .from('notas')
        .insert(nota)
        .select()
        .single();
      if (error) throw error;
      return data as Nota;
    },

    async atualizar(id: string, updates: NotaUpdate, userId: string) {
      const { data, error } = await supabase
        .from('notas')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)
        .eq('user_id', userId)
        .select()
        .single();
      if (error) throw error;
      return data as Nota;
    },

    async excluir(id: string, userId: string) {
      const { error } = await supabase
        .from('notas')
        .delete()
        .eq('id', id)
        .eq('user_id', userId);
      if (error) throw error;
    },
  };
}
