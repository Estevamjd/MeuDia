import type { UUID } from './common';

export interface Medicamento {
  id: UUID;
  user_id: UUID;
  nome: string;
  dosagem: string;
  frequencia: string;
  horarios: string[];
  estoque_atual: number;
  estoque_minimo: number;
  ativo: boolean;
  created_at: string;
}

export interface MedicamentoInsert {
  nome: string;
  dosagem: string;
  frequencia: string;
  horarios: string[];
  estoque_atual?: number;
  estoque_minimo?: number;
  ativo?: boolean;
}

export interface RegistroMedicamento {
  id: UUID;
  medicamento_id: UUID;
  user_id: UUID;
  data_hora: string;
  tomado: boolean;
}

export interface RegistroMedicamentoInsert {
  medicamento_id: UUID;
  data_hora?: string;
  tomado?: boolean;
}
