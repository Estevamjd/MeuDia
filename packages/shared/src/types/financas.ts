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

/** Competência YYYY-MM; validar o formato nas fronteiras da aplicação. */
export type Competencia = string;
export type Recorrencia = 'mensal' | 'anual' | 'unica';
export type SituacaoOcorrencia = 'pendente' | 'vencida' | 'paga';
export type EtapaLembrete = 'D-2' | 'D-1' | 'D0';
export type Selo = 'No controle' | 'Atenção' | 'Apertado';

export interface ContaPagar {
  id: UUID;
  user_id: UUID;
  assinatura_id: UUID | null;
  descricao: string;
  categoria: string;
  valor: number;
  recorrencia: Recorrencia;
  dia_vencimento: number | null;
  mes_vencimento: number | null;
  data_vencimento: string | null;
  ativo: boolean;
  created_at: string | null;
  updated_at: string | null;
}

export interface ContaPagarInsert {
  assinatura_id?: UUID | null;
  descricao: string;
  categoria?: string;
  valor: number;
  recorrencia: Recorrencia;
  dia_vencimento?: number | null;
  mes_vencimento?: number | null;
  data_vencimento?: string | null;
  ativo?: boolean;
}

export interface PagamentoConta {
  id: UUID;
  conta_id: UUID;
  user_id: UUID;
  competencia: Competencia;
  pago_em: string;
  transacao_id: UUID | null;
  created_at: string | null;
}

export interface OcorrenciaConta {
  conta: ContaPagar;
  competencia: Competencia;
  vencimento: string;
  situacao: SituacaoOcorrencia;
  pagamento: PagamentoConta | null;
}

export interface Renda {
  id: UUID;
  user_id: UUID;
  descricao: string;
  valor: number;
  dia_recebimento: number | null;
  ativo: boolean;
  created_at: string | null;
  updated_at: string | null;
}

export interface OrcamentoCategoria {
  id: UUID;
  user_id: UUID;
  categoria: string;
  valor_planejado: number;
  created_at: string | null;
  updated_at: string | null;
}

export interface PushSubscriptionRow {
  id: UUID;
  user_id: UUID;
  endpoint: string;
  p256dh: string;
  auth: string;
  user_agent: string | null;
  created_at: string | null;
  last_used_at: string | null;
}

export interface LembreteEnviado {
  id: UUID;
  user_id: UUID;
  conta_id: UUID;
  competencia: Competencia;
  etapa: EtapaLembrete;
  canal: 'push' | 'email';
  enviado_em: string;
}

export const SELO_LIMITES = { NO_CONTROLE_MAX: 0.7, ATENCAO_MAX: 0.9 } as const;

/** Placeholders substituídos pelo serviço; valor em pt-BR e data dd/MM. */
export const LEMBRETE_TEXTOS = {
  'D-2': { title: 'Vence em breve', body: '<descricao> — R$ <valor> vence <dd/MM>' },
  'D-1': { title: 'Já foi pago?', body: '<descricao> vence amanhã. Toque para marcar como paga.' },
  D0: { title: 'Tá tudo certo?', body: '<descricao> vence hoje. Já pagou?' },
} as const;
