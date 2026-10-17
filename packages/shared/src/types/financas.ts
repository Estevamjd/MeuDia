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
  /** Carteira de onde saiu/para onde entrou; `null` = legado (fora de qualquer saldo). */
  carteira_id?: UUID | null;
  /** Correção de saldo: entra no saldo, mas fica fora de renda/gasto/gráficos. */
  ajuste?: boolean;
}

export interface TransacaoInsert {
  tipo: TipoTransacao;
  categoria: string;
  descricao: string;
  valor: number;
  data?: string;
  banco?: string | null;
  automatico?: boolean;
  carteira_id?: UUID | null;
  ajuste?: boolean;
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
  /** Onde o salário costuma cair (padrão do "Recebi"). */
  carteira_id?: UUID | null;
  created_at: string | null;
  updated_at: string | null;
}

export type TipoCarteira = 'banco' | 'dinheiro' | 'poupanca';

/** "Bancos e carteira": saldo informado (`saldo_inicial`) vale no instante `saldo_inicial_em`. */
export interface Carteira {
  id: UUID;
  user_id: UUID;
  nome: string;
  tipo: TipoCarteira;
  saldo_inicial: number;
  saldo_inicial_em: string;
  incluir_no_total: boolean;
  arquivada: boolean;
  ordem: number;
  created_at: string | null;
  updated_at: string | null;
}

export interface CarteiraInsert {
  nome: string;
  tipo?: TipoCarteira;
  saldo_inicial?: number;
  incluir_no_total?: boolean;
  ordem?: number;
}

export interface Transferencia {
  id: UUID;
  user_id: UUID;
  origem_id: UUID;
  destino_id: UUID;
  valor: number;
  data: string;
  descricao: string | null;
  created_at: string | null;
}

export interface TransferenciaInsert {
  origem_id: UUID;
  destino_id: UUID;
  valor: number;
  data: string;
  descricao?: string | null;
}

export interface RecebimentoRenda {
  id: UUID;
  renda_id: UUID;
  user_id: UUID;
  competencia: Competencia;
  recebido_em: string;
  transacao_id: UUID | null;
  created_at: string | null;
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
