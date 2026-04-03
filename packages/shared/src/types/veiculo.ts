import type { UUID } from './common';

export interface Veiculo {
  id: UUID;
  user_id: UUID;
  modelo: string;
  placa: string | null;
  ano: number | null;
  km_atual: number;
  created_at: string;
  manutencoes?: Manutencao[];
}

export interface VeiculoInsert {
  modelo: string;
  placa?: string | null;
  ano?: number | null;
  km_atual?: number;
}

export interface Manutencao {
  id: UUID;
  veiculo_id: UUID;
  tipo: string;
  data: string;
  km_na_revisao: number | null;
  custo: number | null;
  proxima_revisao_km: number | null;
  observacao: string | null;
}

export interface ManutencaoInsert {
  veiculo_id: UUID;
  tipo: string;
  data: string;
  km_na_revisao?: number | null;
  custo?: number | null;
  proxima_revisao_km?: number | null;
  observacao?: string | null;
}
