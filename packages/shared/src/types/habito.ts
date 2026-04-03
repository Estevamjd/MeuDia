import type { UUID, DiaSemana } from './common';

export type FrequenciaHabito = 'diario' | 'semanal';

export interface Habito {
  id: UUID;
  user_id: UUID;
  nome: string;
  icone: string;
  frequencia: FrequenciaHabito;
  dias_semana: DiaSemana[];
  meta: number;
  ordem: number;
  ativo: boolean;
  created_at: string;
}

export interface HabitoInsert {
  nome: string;
  icone?: string;
  frequencia?: FrequenciaHabito;
  dias_semana?: DiaSemana[];
  meta?: number;
  ordem?: number;
}

export interface RegistroHabito {
  id: UUID;
  habito_id: UUID;
  user_id: UUID;
  data: string;
  concluido: boolean;
  valor: number;
}

export interface RegistroHabitoInsert {
  habito_id: UUID;
  data?: string;
  concluido?: boolean;
  valor?: number;
}

export interface ScoreDiario {
  id: UUID;
  user_id: UUID;
  data: string;
  score: number;
  pts_treino: number;
  pts_habitos: number;
  pts_agua: number;
  pts_calorias: number;
  pts_medicamentos: number;
}

export interface Conquista {
  id: UUID;
  user_id: UUID;
  tipo: string;
  titulo: string;
  descricao: string | null;
  icone: string;
  conquistado_em: string;
}
