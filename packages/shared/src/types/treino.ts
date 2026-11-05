import type { UUID, DiaSemana } from './common';

export type TipoTreino = 'musculacao' | 'cardio' | 'funcional' | 'descanso';

export interface Treino {
  id: UUID;
  user_id: UUID;
  nome: string;
  dia_semana: DiaSemana;
  tipo: TipoTreino | null;
  observacao: string | null;
  ordem: number;
  created_at: string;
  exercicios?: Exercicio[];
}

export interface TreinoInsert {
  nome: string;
  dia_semana: DiaSemana;
  tipo?: TipoTreino | null;
  observacao?: string | null;
  ordem?: number;
}

export interface Exercicio {
  id: UUID;
  treino_id: UUID;
  nome: string;
  series: number;
  /** Faixa em texto ("8–12", "10" ou "" quando a série não conta repetição). Vem de `repeticoes_min`/`max`. */
  repeticoes: string;
  /** 008: faixa de repetições. Os dois NULL = série sem repetição (ex.: prancha). */
  repeticoes_min: number | null;
  repeticoes_max: number | null;
  carga: number | null;
  tempo_descanso: number;
  observacao: string | null;
  ordem: number;
}

export interface ExercicioInsert {
  treino_id: UUID;
  nome: string;
  series?: number;
  /** Texto da faixa ("8-12", "8–12", "10" ou "" para sem repetição); o repositório grava min/max. */
  repeticoes?: string;
  carga?: number | null;
  tempo_descanso?: number;
  observacao?: string | null;
  ordem?: number;
}

export interface SessaoTreino {
  id: UUID;
  user_id: UUID;
  treino_id: UUID | null;
  data: string;
  duracao_minutos: number | null;
  concluido: boolean;
  observacao: string | null;
  created_at: string;
}

export interface SessaoTreinoInsert {
  treino_id?: UUID | null;
  data?: string;
  duracao_minutos?: number | null;
  concluido?: boolean;
  observacao?: string | null;
}

export interface SerieRealizada {
  id: UUID;
  sessao_id: UUID;
  exercicio_id: UUID;
  numero_serie: number;
  carga_usada: number | null;
  reps_feitas: number | null;
  concluido: boolean;
}

export interface SerieRealizadaInsert {
  sessao_id: UUID;
  exercicio_id: UUID;
  numero_serie: number;
  carga_usada?: number | null;
  reps_feitas?: number | null;
  concluido?: boolean;
}
