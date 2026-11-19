/** Registros rápidos de treino e refeição (010): o mesmo formato serve ao app e ao WhatsApp. */
export type OrigemRegistro = 'app' | 'whatsapp';
export type TipoRefeicaoRapida = 'cafe' | 'almoco' | 'lanche' | 'jantar' | 'ceia';

export interface RegistroTreino {
  id: string;
  user_id: string;
  data: string;
  descricao: string;
  duracao_min: number | null;
  origem: OrigemRegistro;
  created_at: string;
}
export type RegistroTreinoInsert = Pick<RegistroTreino, 'descricao' | 'data'> & { duracao_min?: number | null };

export interface RegistroRefeicao {
  id: string;
  user_id: string;
  data: string;
  tipo: TipoRefeicaoRapida;
  descricao: string;
  origem: OrigemRegistro;
  created_at: string;
}
export type RegistroRefeicaoInsert = Pick<RegistroRefeicao, 'descricao' | 'data' | 'tipo'>;
