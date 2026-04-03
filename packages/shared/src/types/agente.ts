import type { UUID, AIPrioridade } from './common';

// ══════════════════════════════════════════════════════════════════════════════
// Tipos de Notificação
// ══════════════════════════════════════════════════════════════════════════════

export type TipoNotificacao = 'alerta' | 'aviso' | 'sucesso' | 'info';

export type ModuloAgente =
  | 'treino'
  | 'habito'
  | 'financas'
  | 'agenda'
  | 'compras'
  | 'veiculo'
  | 'notas'
  | 'geral';

export interface AcaoRapida {
  label: string;
  acao: string;
  payload?: Record<string, unknown>;
}

export interface NotificacaoAgente {
  id: UUID;
  user_id: UUID;
  tipo: TipoNotificacao;
  titulo: string;
  mensagem: string;
  modulo: ModuloAgente;
  lida: boolean;
  dispensada: boolean;
  acoes: AcaoRapida[];
  created_at: string;
}

export interface NotificacaoAgenteInsert {
  tipo: TipoNotificacao;
  titulo: string;
  mensagem: string;
  modulo: ModuloAgente;
  acoes?: AcaoRapida[];
}

// ══════════════════════════════════════════════════════════════════════════════
// Chat
// ══════════════════════════════════════════════════════════════════════════════

export type ChatRole = 'user' | 'agent';

export interface MensagemChat {
  id: UUID;
  user_id: UUID;
  role: ChatRole;
  conteudo: string;
  intencao: string | null;
  acoes: AcaoRapida[];
  created_at: string;
}

export interface MensagemChatInsert {
  role: ChatRole;
  conteudo: string;
  intencao?: string;
  acoes?: AcaoRapida[];
}

// ══════════════════════════════════════════════════════════════════════════════
// Ações do Agente
// ══════════════════════════════════════════════════════════════════════════════

export type StatusAcao = 'pendente' | 'executada' | 'falhou';

export interface AcaoAgente {
  id: UUID;
  user_id: UUID;
  tipo: string;
  payload: Record<string, unknown>;
  status: StatusAcao;
  resultado: Record<string, unknown> | null;
  created_at: string;
}

export interface AcaoAgenteInsert {
  tipo: string;
  payload: Record<string, unknown>;
}

// ══════════════════════════════════════════════════════════════════════════════
// Preferências
// ══════════════════════════════════════════════════════════════════════════════

export interface PreferenciasAgente {
  user_id: UUID;
  notif_faltou_treino: boolean;
  notif_habito_pendente: boolean;
  horario_verificacao: string;
  timer_descanso_auto: boolean;
  sugestao_carga_auto: boolean;
  chat_ativo: boolean;
  created_at: string;
}

export interface PreferenciasAgenteUpdate {
  notif_faltou_treino?: boolean;
  notif_habito_pendente?: boolean;
  horario_verificacao?: string;
  timer_descanso_auto?: boolean;
  sugestao_carga_auto?: boolean;
  chat_ativo?: boolean;
}

// ══════════════════════════════════════════════════════════════════════════════
// Classificação de Intenção
// ══════════════════════════════════════════════════════════════════════════════

export type TipoIntencao =
  | 'CONSULTA_TREINO'
  | 'CRIAR_TREINO'
  | 'AGENDAR_TREINO'
  | 'CONSULTA_HABITOS'
  | 'CONSULTA_AGENDA'
  | 'CONSULTA_FINANCAS'
  | 'RESUMO_DIA'
  | 'CRIAR_COMPROMISSO'
  | 'CRIAR_HABITO'
  | 'CRIAR_TRANSACAO'
  | 'CONSULTA_NOTAS'
  | 'SAUDACAO'
  | 'GENERICA';

export interface Intencao {
  tipo: TipoIntencao;
  confianca: number;
  parametros?: Record<string, string>;
}

// ══════════════════════════════════════════════════════════════════════════════
// Resposta do Agente
// ══════════════════════════════════════════════════════════════════════════════

export interface RespostaAgente {
  mensagem: string;
  acoes?: AcaoRapida[];
  dados?: Record<string, unknown>;
}

// ══════════════════════════════════════════════════════════════════════════════
// Contexto Completo do Usuário (para o agente)
// ══════════════════════════════════════════════════════════════════════════════

export interface ContextoUsuario {
  userId: UUID;
  nome: string;
  objetivo: string | null;
  horaAtual: number;
  diaSemana: number;

  // Treino
  treinoHoje: {
    nome: string;
    exercicios: number;
    concluido: boolean;
  } | null;
  sessoesSemana: number;
  metaTreinosSemana: number;

  // Hábitos
  habitosTotal: number;
  habitosConcluidos: number;
  habitosPendentes: string[];
  percentualHabitos: number;

  // Agenda
  compromissosHoje: number;
  proximoCompromisso: string | null;

  // Finanças
  saldoMes: number;
  despesasMes: number;
  receitasMes: number;

  // Geral
  streakAtual: number;
  scoreHoje: number;
}

// ══════════════════════════════════════════════════════════════════════════════
// Regras de Notificação do Agente
// ══════════════════════════════════════════════════════════════════════════════

export interface RegraNotificacao {
  id: string;
  modulo: ModuloAgente;
  verificar: (contexto: ContextoUsuario) => NotificacaoAgenteInsert | null;
}

// ══════════════════════════════════════════════════════════════════════════════
// Sugestão de Carga (Treino)
// ══════════════════════════════════════════════════════════════════════════════

export type TipoSugestaoCarga = 'AUMENTAR' | 'REDUZIR' | 'MANTER';

export interface SugestaoCarga {
  sugestao: TipoSugestaoCarga;
  cargaAtual: number;
  cargaSugerida: number;
  motivo: string;
}

// ══════════════════════════════════════════════════════════════════════════════
// Treino Gerado pelo Agente
// ══════════════════════════════════════════════════════════════════════════════

export interface ExercicioGerado {
  nome: string;
  series: number;
  repeticoes: string;
  tempoDescanso: number;
}

export interface TreinoGerado {
  nome: string;
  tipo: string;
  exercicios: ExercicioGerado[];
  duracaoEstimada: number;
  nivel: string;
}

// ══════════════════════════════════════════════════════════════════════════════
// Resumo Diário
// ══════════════════════════════════════════════════════════════════════════════

export interface ResumoDiario {
  saudacao: string;
  mensagemPrincipal: string;
  itens: ItemResumo[];
  acoes: AcaoRapida[];
  prioridade: AIPrioridade;
}

export interface ItemResumo {
  icone: string;
  texto: string;
  modulo: ModuloAgente;
}
