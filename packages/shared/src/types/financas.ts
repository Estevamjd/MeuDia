import type { UUID } from './common';

export type TipoTransacao = 'receita' | 'despesa';

export interface Transacao {
  id: UUID;
  user_id: UUID;
  tipo: TipoTransacao;
  categoria: string;
  descricao: string;
  valor: number;
  data: string;
  banco: string | null;
  automatico: boolean;
  created_at: string;
}

export interface TransacaoInsert {
  tipo: TipoTransacao;
  categoria: string;
  descricao: string;
  valor: number;
  data?: string;
  banco?: string | null;
  automatico?: boolean;
}

export interface Assinatura {
  id: UUID;
  user_id: UUID;
  nome: string;
  valor: number;
  dia_vencimento: number;
  icone: string;
  cor: string;
  ativo: boolean;
  created_at: string;
}

export interface AssinaturaInsert {
  nome: string;
  valor: number;
  dia_vencimento: number;
  icone?: string;
  cor?: string;
  ativo?: boolean;
}
