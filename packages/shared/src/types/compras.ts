import type { UUID } from './common';

export interface ListaCompras {
  id: UUID;
  user_id: UUID;
  nome: string;
  created_at: string;
  itens?: ItemCompra[];
}

export interface ListaComprasInsert {
  nome?: string;
}

export interface ItemCompra {
  id: UUID;
  lista_id: UUID;
  nome: string;
  quantidade: number;
  unidade: string;
  categoria: string | null;
  comprado: boolean;
  preco_estimado: number | null;
}

export interface ItemCompraInsert {
  lista_id: UUID;
  nome: string;
  quantidade?: number;
  unidade?: string;
  categoria?: string | null;
  comprado?: boolean;
  preco_estimado?: number | null;
}
