import type { UUID } from './common';

export type TipoRefeicao = 'cafe' | 'lanche_manha' | 'almoco' | 'lanche_tarde' | 'jantar' | 'ceia';

export interface ItemRefeicao {
  nome: string;
  calorias: number;
  proteina?: number;
  carbo?: number;
  gordura?: number;
  quantidade?: number;
}

export interface Refeicao {
  id: UUID;
  user_id: UUID;
  tipo: TipoRefeicao;
  data: string;
  items: ItemRefeicao[];
  total_calorias: number;
  total_proteina: number;
  total_carbo: number;
  total_gordura: number;
}

export interface RefeicaoInsert {
  tipo: TipoRefeicao;
  data?: string;
  items: ItemRefeicao[];
  total_calorias?: number;
  total_proteina?: number;
  total_carbo?: number;
  total_gordura?: number;
}

export interface RegistroPeso {
  id: UUID;
  user_id: UUID;
  peso: number;
  data: string;
  observacao: string | null;
}

export interface RegistroPesoInsert {
  peso: number;
  data?: string;
  observacao?: string | null;
}

export interface RegistroAgua {
  id: UUID;
  user_id: UUID;
  data: string;
  copos_bebidos: number;
  meta_copos: number;
}

export interface RegistroAguaInsert {
  data?: string;
  copos_bebidos?: number;
  meta_copos?: number;
}
