export type UUID = string;

export type Prioridade = 'baixa' | 'media' | 'alta' | 'urgente';

export type DiaSemana = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export type Objetivo = 'saude_geral' | 'emagrecer' | 'ganhar_massa' | 'condicionamento';

export type AIPrioridade = 'info' | 'aviso' | 'alerta';

export interface PaginatedResult<T> {
  data: T[];
  count: number;
  page: number;
  pageSize: number;
}
