import type { UUID, Prioridade } from './common';

export interface Compromisso {
  id: UUID;
  user_id: UUID;
  titulo: string;
  descricao: string | null;
  data_inicio: string;
  data_fim: string | null;
  local: string | null;
  tipo: string;
  prioridade: Prioridade;
  concluido: boolean;
  created_at: string;
}

export interface CompromissoInsert {
  titulo: string;
  descricao?: string | null;
  data_inicio: string;
  data_fim?: string | null;
  local?: string | null;
  tipo?: string;
  prioridade?: Prioridade;
  concluido?: boolean;
}
