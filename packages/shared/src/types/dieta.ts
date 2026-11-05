import type { UUID } from './common';

export type TipoRefeicao = 'cafe' | 'lanche_manha' | 'almoco' | 'lanche_tarde' | 'jantar' | 'ceia';

/** De onde veio o valor do item: TACO, rótulo do produto ou digitado pela pessoa. */
export type FonteNutricional = 'taco' | 'rotulo' | 'manual';

/**
 * Item de refeição (JSONB `refeicoes.items`). Nutriente null = "sem valor" (fora da TACO, "NA", "Tr", "*"
 * ou vazio): nunca vira 0. Itens antigos têm só números e seguem válidos.
 */
export interface ItemRefeicao {
  nome: string;
  calorias: number | null;
  proteina?: number | null;
  carbo?: number | null;
  gordura?: number | null;
  /** Gramas (ou unidade antiga). */
  quantidade?: number | null;
  fonte?: FonteNutricional;
  taco_id?: number | null;
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
  quantidade_ml: number;
  meta_ml: number;
  created_at: string;
  updated_at: string;
}

export interface RegistroAguaInsert {
  data?: string;
  quantidade_ml?: number;
  meta_ml?: number;
}
