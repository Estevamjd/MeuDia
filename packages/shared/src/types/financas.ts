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
  categoria: string;
  lembrete_dias_antes: number | null;
  icone: string;
  cor: string;
  ativo: boolean;
  created_at: string;
}

export interface AssinaturaInsert {
  nome: string;
  valor: number;
  dia_vencimento: number;
  categoria?: string;
  lembrete_dias_antes?: number | null;
  icone?: string;
  cor?: string;
  ativo?: boolean;
}

export type StatusContaPagar = 'pendente' | 'paga' | 'cancelada';

export interface ContaPagar {
  id: UUID;
  user_id: UUID;
  assinatura_id: UUID | null;
  descricao: string;
  categoria: string;
  valor: number;
  vencimento: string;
  status: StatusContaPagar;
  pago_em: string | null;
  transacao_id: UUID | null;
  lembrete_dias_antes: number | null;
  lembrete_enviado_em: string | null;
  alerta_atraso_enviado_em: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface ContaPagarInsert {
  assinatura_id?: UUID | null;
  descricao: string;
  categoria?: string;
  valor: number;
  vencimento: string;
  lembrete_dias_antes?: number | null;
}
